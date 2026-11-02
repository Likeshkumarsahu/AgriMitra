"""RAG pipeline for the AgriMitra chatbot.

Query → translate Hindi if needed → embed locally → retrieve top-k chunks from
ChromaDB → prompt the configured LLM → answer + sources.

Degradation chain:
  1. Chroma/embedding fails         → token-based keyword search over data/chatbot-index.json
  2. Retrieval returns nothing      → LLM answers from general agronomy knowledge and
                                      the reply is marked ungrounded
  3. LLM unreachable/timeout        → return retrieved snippets verbatim as sources
  4. LLM and retrieval both fail    → the API returns 503
"""
import json
import logging
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

from app import db
from app.config import get_settings
from app.models.chat import ChatSource
from app.services.llm import LLMError, complete

log = logging.getLogger("agrimitra.rag")

GREETINGS = {
    "en": {"hi": "Hello! I'm Mitra 🌾 — your agriculture assistant. Ask me about soil, seeds, crops, irrigation, pests or anything from our 36+ learning modules.",
           "help": "You can ask me things like “what is NPK?”, “recommend crops for sandy soil”, or paste any farming question.",
           "thanks": "You're welcome! 😊 How can I help you today?"},
    "hi": {"hi": "नमस्ते! मैं मित्रा हूँ 🌾 — आपकी कृषि सहायिका। मिट्टी, बीज, फसल, सिंचाई, कीट या हमारे 36+ पाठ्यक्रम के बारे में पूछें।",
           "thanks": "आपका धन्यवाद! कुछ और पूछें। 😊",
           "help": "आप पूछ सकते हैं: “NPK क्या है?”, “रेतीली मिट्टी के लिए फसल?”, या कोई खेती का सवाल।"},
}

KEYWORD_STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "is", "are", "was", "for", "and", "or",
    "what", "whats", "which", "how", "why", "where", "when", "can", "do", "does",
    "about", "me", "my", "please", "tell", "explain", "give", "list", "some",
    "आप", "क्या", "है", "मुझे", "बताओ", "बताइए", "कैसे", "कहाँ", "कौन", "किस",
}


@lru_cache(maxsize=1)
def _load_keyword_index() -> list[dict]:
    index_file = Path(get_settings().data_dir) / "chatbot-index.json"
    try:
        with open(index_file, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        log.error("Could not load chatbot-index.json: %s", exc)
        return []


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z\u0900-\u097F]{2,}", text.lower())
    return [t for t in tokens if t not in KEYWORD_STOPWORDS]


def _slugify(text: str) -> str:
    """Match the frontend `anchor()` implementation used for heading ids."""
    text = text.lower().replace("—", "-").replace("–", "-")
    text = re.sub(r"[^\w\s-]", "", text).strip()
    return re.sub(r"\s+", "-", text)


def _course_link(course_slug: str, section: str, link: str | None = None) -> str:
    if link:
        return link
    if not course_slug:
        return "/courses"
    anchor = _slugify(section)
    return f"/courses/{course_slug}#{anchor}" if anchor else f"/courses/{course_slug}"


def keyword_search(query: str, top_k: int = 5) -> list[dict]:
    """Token-based keyword retrieval over the prebuilt index (no network).

    Uses whole-token matching, so “rice” does not score a chunk that only
    contains “price”. This is a cheap BM25-like fallback, not a substring scan.
    """
    index = _load_keyword_index()
    q_terms = _tokenize(query)
    if not q_terms:
        return []
    scored = []
    for chunk in index:
        text = chunk.get("course", "") + " " + chunk.get("section", "") + " " + chunk.get("text", "")
        counts = Counter(_tokenize(text))
        score = sum(counts[term] for term in q_terms)
        if score > 0:
            scored.append((score / len(q_terms), chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def _chroma_search(query: str, top_k: int) -> list[dict]:
    settings = get_settings()
    collection = db.chroma.get_collection()
    res = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    documents = (res.get("documents") or [[]])[0]
    metadatas = (res.get("metadatas") or [[]])[0]
    distances = (res.get("distances") or [[]])[0]
    chunks = []
    for i, document in enumerate(documents):
        distance = distances[i] if i < len(distances) else None
        if distance is not None and distance > settings.chroma_max_distance:
            continue
        meta = metadatas[i] if i < len(metadatas) and metadatas[i] else {}
        chunks.append(
            {
                "course": meta.get("course", "Agriculture"),
                "courseSlug": meta.get("courseSlug", ""),
                "section": meta.get("section", ""),
                "text": (document or "")[:1100],
                "link": meta.get("link", ""),
            }
        )
    log.debug(
        "Chroma returned %d/%d chunks within distance %.2f",
        len(chunks),
        len(documents),
        settings.chroma_max_distance,
    )
    return chunks


def retrieve(query: str, top_k: int | None = None) -> tuple[list[dict], bool]:
    """Return (chunks, degraded_flag)."""
    settings = get_settings()
    top_k = top_k or settings.rag_top_k
    try:
        chunks = _chroma_search(query, top_k)
        if chunks:  # empty collection/query is not an error — keep degrading
            return chunks, False
    except Exception as exc:  # noqa: BLE001 — any retrieval error degrades gracefully
        log.warning("Chroma retrieval failed, using keyword search: %s", exc)
    return keyword_search(query, top_k), True


@lru_cache(maxsize=256)
def _translate_to_english(text: str) -> str:
    """Translate a Hindi/Hinglish query to English for the English corpus.

    The local MiniLM embedding model is English-only. Translating the query
    first gives Hindi questions a meaningful vector/keyword match; if the LLM
    is unavailable we keep the original query and let the normal fallbacks run.
    """
    if not re.search(r"[\u0900-\u097F]", text):
        return text
    try:
        translated = complete(
            "Translate the user's Hindi or Hinglish farming question into concise English. "
            "Return only the English translation, with no commentary.",
            [{"role": "user", "content": text}],
            lang="en",
        )
        return translated.strip() or text
    except LLMError as exc:
        log.warning("Hindi query translation failed; using original query: %s", exc)
        return text


def _handle_greeting(message: str, lang: str) -> str | None:
    m = message.strip().lower()
    tokens = [t for t in re.findall(r"[a-zA-Z\u0900-\u097F]+", m) if t]
    if len(tokens) > 4:
        return None
    table = GREETINGS.get(lang, GREETINGS["en"])
    if re.fullmatch(r"(hi|hello|hey|namaste|namaskar|सलाम|हैलो|नमस्ते)[!. \u0900-\u097F]*", m):
        return table["hi"]
    if any(w in tokens for w in ("thanks", "thank", "thankyou", "thx", "धन्यवाद")) or any(w in m for w in ("thank you",)):
        if "thanks" in table:
            return table["thanks"]
        return table.get("hi")
    if len(tokens) == 1 and tokens[0] in ("help", "sos", "सहायता", "मदद"):
        return table["help"]
    return None


def answer(message: str, lang: str = "en") -> tuple[str, list[ChatSource], bool, bool]:
    """Full RAG turn → (reply, sources, llm_fallback_used, grounded)."""
    canned = _handle_greeting(message, lang)
    if canned:
        return canned, [], False, True

    # Translate Devanagari queries first: the local MiniLM embedding model is
    # English-only. `_translate_to_english` is a no-op for Latin-script text even
    # if the UI language is Hindi.
    retrieval_query = _translate_to_english(message)
    chunks, _ = retrieve(retrieval_query)

    sources = []
    context_parts = []
    for i, ch in enumerate(chunks, start=1):
        context_parts.append(f"[{i}] (course: {ch['course']} | section: {ch['section']}):\n{ch['text']}")
        sources.append(
            ChatSource(
                course=ch["course"],
                courseSlug=ch.get("courseSlug", ""),
                section=ch.get("section", "Overview"),
                link=_course_link(ch.get("courseSlug", ""), ch.get("section", ""), ch.get("link")),
                snippet=ch["text"][:160],
            )
        )

    grounded = bool(context_parts)
    lang_hint = "Hindi" if lang == "hi" else "English"
    no_retrieval_note = (
        " Retrieval returned nothing: answer briefly from your own farming knowledge, "
        "clearly say the topic may not be covered in the course library yet, and do not invent "
        "pesticide, herbicide, or fertilizer doses." if not grounded else ""
    )
    system = (
        "You are Mitra, an agronomy advisor on the AgriMitra learning platform. "
        "Base your answer on RETRIEVED_DOCUMENTS when they are provided, citing them inline as [1], [2]. "
        "If they give no answer, use your own short farming knowledge instead — do not apologise. "
        "Never invent pesticide, herbicide, or fertilizer doses: if the retrieved documents do not "
        "state an exact dose, tell the user to confirm it with a local extension officer. "
        "Keep the reply under 180 words, plain and practical, with short bullets where useful. "
        "Reply in the user's language — use " + lang_hint + "."
    ) + no_retrieval_note
    user_msg = message
    if context_parts:
        user_msg = "RETRIEVED_DOCUMENTS:\n" + "\n\n".join(context_parts) + "\n\nUSER QUESTION:\n" + message

    try:
        reply = complete(system, [{"role": "user", "content": user_msg}], lang=lang)
        if not grounded:
            note = (
                "\n\n_यह उत्तर पाठ्यक्रम पुस्तकालय से नहीं लिया गया है — रासायनिक/खाद की मात्रा स्थानीय कृषि अधिकारी से पुष्टि करें।_"
                if lang == "hi"
                else "\n\n_This answer is not grounded in the AgriMitra course library. Confirm any pesticide or fertilizer dose with a local extension officer._"
            )
            reply = f"{reply}{note}"
        return reply, sources, False, grounded
    except LLMError as exc:
        log.warning("LLM unavailable — serving retrieved snippets: %s", exc)
        if not sources:
            return (
                "The chatbot's AI service is busy right now. I could not find a matching "
                "note in the course library either — try again shortly, or browse the Courses section.",
                [],
                True,
                False,
            )
        return (
            "The chatbot's AI service is busy right now — here are the closest matches from the course library:\n\n"
            + "\n".join(
                f"• **[{i}] {s.course} — {s.section}**: {s.snippet}..."
                for i, s in enumerate(sources, start=1)
            ),
            sources,
            True,
            True,
        )