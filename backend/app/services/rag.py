"""RAG pipeline for the AgriMitra chatbot.

Query → embed (Gemini) → retrieve top-k chunks from ChromaDB
→ prompt LLM (Gemini, Groq fallback) → answer + sources.

Degradation chain (nothing ever 500s):
  1. Chroma/Gemini-embedding fails  → keyword search over data/chatbot-index.json
  2. Retrieval returns nothing      → LLM answers humbly from general agronomy knowledge
  3. LLM unreachable/timeout        → return retrieved snippets verbatim as sources
"""
import json
import logging
import re
from collections import Counter
from pathlib import Path

from app import db
from app.config import get_settings
from app.models.chat import ChatSource
from app.services.llm import LLMError, complete

log = logging.getLogger("agrimitra.rag")

GREETINGS = {
    "en": {"hi": "Hello! I'm Mitra 🌾 — your agriculture assistant. Ask me about soil, seeds, crops, irrigation, pests or anything from our 36+ learning modules.",
           "help": "You can ask me things like “what is NPK?”, “recommend crops for sandy soil”, or paste any farming question.",
           "oi": "Namaste! 🙏 I'm Mitra. I can answer from our agricultural knowledge base. Try “what is green manure?”"},
    "hi": {"hi": "नमस्ते! मैं मित्रा हूँ 🌾 — आपकी कृषि सहायिका। मिट्टी, बीज, फसल, सिंचाई, कीट या हमारे 36+ पाठ्यक्रम के बारे में पूछें।",
           "thanks": "आपकी अनुग्रहिता के लिए धन्यवाद! कुछ और पूछें। 😊",
           "help": "आप पूछ सकते हैं: “NPK क्या है?”, “रेतीली मिट्टी के लिए फसल?”, या कोई खेती का सवाल।"},
}

KEYWORD_STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "is", "are", "was", "for", "and", "or",
    "what", "whats", "which", "how", "why", "where", "when", "can", "do", "does",
    "about", "me", "my", "please", "tell", "explain", "give", "list", "some",
    "आप", "क्या", "है", "मुझे", "बताओ", "बताइए", "कैसे", "कहाँ", "कौन", "किस",
}


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
    text = text.lower().replace("—", "-").replace("–", "-")
    return re.sub(r"-+", "-", re.sub(r"[^\w\s-]", "", text)).strip().replace(" ", "-")


def keyword_search(query: str, top_k: int = 5) -> list[dict]:
    """BM25-ish keyword retrieval over the prebuilt index (no network)."""
    index = _load_keyword_index()
    q_terms = _tokenize(query)
    if not q_terms:
        return []
    scored = []
    for chunk in index:
        text = (chunk.get("course", "") + " " + chunk.get("section", "") + " " + chunk.get("text", "")).lower()
        counts = Counter(
            term for term in q_terms if term in text
        )
        score = sum(counts.values())
        if score > 0:
            scored.append((score / len(q_terms), chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def _chroma_search(query: str, top_k: int) -> list[dict]:
    collection = db.chroma.get_collection()
    res = collection.query(query_texts=[query], n_results=top_k)
    chunks = []
    for i in range(len(res["ids"][0])):
        meta = (res.get("metadatas") or [{}])[0][i] or {}
        chunks.append(
            {
                "course": meta.get("course", "Agriculture"),
                "courseSlug": meta.get("courseSlug", ""),
                "section": meta.get("section", ""),
                "text": (res["documents"][0][i] or "")[:1100],
            }
        )
    return chunks


def retrieve(query: str, top_k: int = 5) -> tuple[list[dict], bool]:
    """Return (chunks, degraded_flag)."""
    try:
        if get_settings().gemini_api_key:
            chunks = _chroma_search(query, top_k)
            if chunks:  # empty collection/query is not an error — keep degrading
                return chunks, False
    except Exception as exc:  # noqa: BLE001 — any retrieval error degrades gracefully
        log.warning("Chroma retrieval failed, using keyword search: %s", exc)
    return keyword_search(query, top_k), True


def _handle_greeting(message: str, lang: str) -> str | None:
    m = message.strip().lower()
    table = GREETINGS.get(lang, GREETINGS["en"])
    if re.fullmatch(r"(hi|hello|hey|namaste|namaskar|सलाम|हैलो|नमस्ते)[!. \u0900-\u097F]*", m):
        return table["hi"]
    if any(w in m for w in ("thanks", "thank", "धन्यवाद")):
        return table["thanks"]
    if m in ("help", "sos", "सहायता", "मदद"):
        return table["help"]
    return None


def answer(message: str, lang: str = "en") -> tuple[str, list[ChatSource], bool]:
    """Full RAG turn → (reply, sources, llm_fallback_used)."""
    canned = _handle_greeting(message, lang)
    if canned:
        return canned, [], False

    # retrieve
    chunks, _degraded_retrieval = retrieve(message)

    sources = []
    context_parts = []
    for i, ch in enumerate(chunks, start=1):
        context_parts.append(f"[{i}] (course: {ch['course']} | section: {ch['section']}):\n{ch['text']}")
        sources.append(
            ChatSource(
                course=ch["course"],
                courseSlug=ch.get("courseSlug", ""),
                section=ch.get("section", "Overview"),
                link=f"/courses/{ch.get('courseSlug', '')}#{_slugify(ch.get('section', ''))}",
                snippet=ch["text"][:160],
            )
        )

    lang_hint = "Hindi" if lang == "hi" else "English"
    no_retrieval_note = (
        " Retrieval returned nothing: answer briefly from your own farming knowledge, "
        "and note the topic may not be covered in the course library yet." if not context_parts else ""
    )
    system = (
        "You are Mitra, an agronomy advisor on the AgriMitra learning platform. "
        "Base your answer on RETRIEVED_DOCUMENTS when they are provided, citing them inline as [1], [2]. "
        "If they give no answer, use your own short farming knowledge instead — do not apologise. "
        "Keep the reply under 180 words, plain and practical, with short bullets where useful. "
        "Reply in the user's language — use " + lang_hint + "."
    ) + no_retrieval_note
    user_msg = message
    if context_parts:
        user_msg = "RETRIEVED_DOCUMENTS:\n" + "\n\n".join(context_parts) + "\n\nUSER QUESTION:\n" + message

    try:
        reply = complete(system, [{"role": "user", "content": user_msg}], lang=lang)
        return reply, sources, False
    except LLMError as exc:
        log.warning("LLM unavailable — serving retrieved snippets: %s", exc)
        if not sources:
            return (
                "The chatbot's AI service is busy right now. I could not find a matching "
                "note in the course library either — try again shortly, or browse the Courses section.",
                [],
                True,
            )
        return (
            "The chatbot's AI service is busy right now — here are the closest matches from the course library:\n\n"
            + "\n".join(f"• **[1] {s.course} — {s.section}**: {s.snippet}..." for s in sources),
            sources,
            True,
        )