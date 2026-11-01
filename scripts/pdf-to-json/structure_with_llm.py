"""structure_with_llm.py — turns extracted topics into website-ready JSON via Ollama.

Pipeline:
  extract_topics.py  →  {title, source, start_page, end_page, raw_text, …}
  structure_with_llm.py →   [{slug, title, category, definition, sections, source,
                              related}, …]   (the schema the website renders)

Runs 100% locally against your Ollama server (default model llama3.2:3b) — no
cloud API keys, private by design. Every topic is passed to the model **one at
a time** with its page number, and `format: "json"` forces the model to emit
structurally valid JSON. The `OLLAMA_FORMAT_JSON` flag is used for models that
support Ollama's JSON grammar; verify with `ollama pull llama3.2:3b`.

Table-aware: topics whose source page contains a real PDF table (pest/disease
tables, variety comparisons, fertiliser schedules…) are fed the table extracted
by pdfplumber rather than the scrambled plain-text body — plain text interleaves
table columns and produces wrong "facts".

Usage:
    export OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
    uv run python structure_with_llm.py --limit 20 --output ../data/structured_topics.json

Supports resuming: run with your existing --output file and already-written
slugs are skipped.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx
import pdfplumber  # noqa: F401 — used by extract_topics; kept for clarity

from extract_topics import AGRI_DATA, discover_books, extract_all

DEFAULT_MODEL = "llama3.2:3b"
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# The exact JSON the website renders. Tell the model to use ONLY facts that
# appear in the source text.
SYSTEM_PROMPT = """You restructure raw agricultural textbook text into a fixed JSON schema \
for a farming knowledge website. Use ONLY facts present in the source text — never add \
information that isn't stated. If the source text is garbled, incomplete, or clearly not \
substantive enough to form a real article (e.g. a stray table-of-contents line, a caption \
fragment, or an index entry), respond with exactly: {"skip": true}

Otherwise respond with ONLY valid JSON matching this schema, nothing else:
{
  "slug": "kebab-case-slug",
  "title": "Title Case Title",
  "category": "one of: Technical and Production Science | Digital Literacy and AgTech | \
Business and Agribusiness | Sustainability and Environment | Communication and Extension",
  "definition": "one clear sentence defining the topic",
  "sections": [
    {"heading": "...", "type": "text", "content": "..."},
    {"heading": "...", "type": "list", "items": ["...", "..."]},
    {"heading": "...", "type": "table", "rows": [["col1", "col2"], ["a", "b"]]}
  ],
  "related": ["other-slug-1", "other-slug-2"]
}

Use "type": "text" for paragraphs, "list" for bullet-style enumerations and \
"table" ONLY when the source really is a table."""

TABLE_AWARE_QUERY = "Topic title: {title}\n\nSource text:\n{source_text}"


def get_table_text_if_present(source: str, page: int) -> str | None:
    """If this topic's page contains a real table, extract it properly
    instead of relying on scrambled plain text."""
    path = AGRI_DATA / source
    try:
        with pdfplumber.open(path) as pdf:
            if page - 1 >= len(pdf.pages):
                return None
            tables = pdf.pages[page - 1].extract_tables()
            if not tables:
                return None
            rows = []
            for table in tables:
                for row in table:
                    rows.append(" | ".join((cell or "").replace("\n", " ") for cell in row))
            return "\n".join(rows)
    except Exception:  # noqa: BLE001
        return None


def ollama_chat_json(client: httpx.Client, url: str, model: str,
                     system: str, user: str, timeout: float = 180.0) -> str:
    """POST /api/chat with format:json; returns the raw model text (pure JSON)."""
    path = f"{url}/api/chat"
    # "format": "json" makes Ollama guarantee structural JSON — essential for
    # line-noise-prone small models (reduces retries + skip rates a lot).
    try:
        resp = client.post(
            path,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "format": "json",
                "keep_alive": "10m",  # keep llama loaded between topics
                "options": {"temperature": 0.1, "num_predict": 1024},
            },
            timeout=httpx.Timeout(timeout, connect=5.0),
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Ollama request failed ({url}): {exc}") from exc
    data = resp.json()
    return (data.get("message") or {}).get("content", "").strip()


def structure_topic(client, url, model, topic: dict) -> dict | None:
    table_text = get_table_text_if_present(topic["source"], topic["start_page"])
    source_text = table_text or topic["raw_text"]

    text = ollama_chat_json(
        client, url, model,
        SYSTEM_PROMPT,
        TABLE_AWARE_QUERY.format(title=topic["title"], source_text=source_text),
    )
    # Defensive: strip fences if a model ever emits them despite format:json.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        print(f"  [skip] unparseable JSON for '{topic['title']}'")
        return None

    if parsed.get("skip"):
        return None
    # Reject empty articles so we never pollute the site content.
    if not parsed.get("title") or not parsed.get("sections"):
        print(f"  [skip] empty article for '{topic['title']}'")
        return None

    parsed["_topic"] = topic["title"]  # internal resume marker (exact source heading)
    parsed["source"] = f"{topic['source']}, p.{topic['start_page']}"
    return parsed


def structure_topic_retry(url, model, topic: dict, attempts: int = 3) -> dict | None:
    """Call structure_topic with a fresh connection per try.

    Ollama occasionally drops a connection mid-call (server restart, model
    reload, OOM). Each attempt opens its own httpx.Client so a stale pooled
    connection can never poison the retry.
    """
    for attempt in range(1, attempts + 1):
        try:
            with httpx.Client() as client:
                return structure_topic(client, url, model, topic)
        except Exception as exc:  # noqa: BLE001
            if attempt < attempts:
                wait = 3 * attempt
                print(f"  [retry {attempt + 1}/{attempts}] {exc} (waiting {wait}s)")
                time.sleep(wait)
            else:
                raise


def backfill_markers(output: Path, topics: list[dict]) -> None:
    """One-time migration for articles written before the '_topic' marker existed.

    Existing articles are aligned to detected topics by source file + order
    (both come from the same extraction, so position N in the file matches
    position N of that file's topics). Marks each matching article with the
    exact source heading so future runs skip it.
    """
    articles = json.loads(output.read_text("utf-8"))
    if not articles:
        print("Output file is empty — nothing to backfill.")
        return

    def base_file(source: str) -> str:
        return source.split(", p.")[0] if source else ""

    by_file_topics: dict[str, list[dict]] = {}
    for t in topics:
        by_file_topics.setdefault(t["source"], []).append(t)

    tagged = missed = 0
    previewed = 0
    per_file_pos: dict[str, int] = {}
    for art in articles:
        if art.get("_topic"):
            tagged += 1
            continue
        f = base_file(art.get("source", ""))
        holders = by_file_topics.get(f)
        pos = per_file_pos.get(f, 0)
        per_file_pos[f] = pos + 1
        if not holders or pos >= len(holders):
            missed += 1
            print(f"  ? no matching topic for #{pos} '{art.get('title', '')[:45]}' (source {art.get('source')})")
            continue
        topic = holders[pos]
        art["_topic"] = topic["title"]
        art["source"] = f"{topic['source']}, p.{topic['start_page']}"
        tagged += 1
        if previewed < 3:
            print(f"  # {art['title'][:45]:<46} <- topic '{topic['title'][:40]}'")
            previewed += 1

    print(f"\n{tagged} articles now carry a resume marker "
          f"({missed} unmatched)" + (" — rerun to continue from here." if tagged else ""))
    if missed:
        print("Unmatched articles were left unchanged. Check the topic order/books "
              "(--book filters apply) and rerun --backfill-markers.")
    output.write_text(json.dumps(articles, indent=2), "utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--limit", type=int, default=None,
                    help="Only process the first N topics (default: all not-yet-done ones)")
    ap.add_argument("--output", default=Path(__file__).parent / "structured_topics.json",
                    help="JSON output path (resumes from existing slugs in this file)")
    ap.add_argument("--model", default=DEFAULT_MODEL,
                    help=f"Ollama model (default {DEFAULT_MODEL})")
    ap.add_argument("--ollama-url", default=DEFAULT_OLLAMA_URL, help="Ollama API base URL")
    ap.add_argument("--min-words", type=int, default=40, help="Topic min body words")
    ap.add_argument("--book", action="append", default=None,
                    help="Only process this PDF filename (repeatable; default: all)")
    ap.add_argument("--strip-internal", action="store_true",
                    help="Remove the internal '_topic' resume marker from the output JSON "
                         "(do this only on the final export, never while still resuming)")
    ap.add_argument("--backfill-markers", action="store_true",
                    help="One-time: mark articles written by an older version as resumed, "
                         "matching them by order to the detected topics, so future runs skip them")
    args = ap.parse_args()

    # Sanity checks before hitting the model.
    try:
        with httpx.Client(timeout=5.0) as client:
            tags = client.get(f"{args.ollama_url}/api/tags").json()
        installed = {m["name"] for m in tags.get("models", [])}
        if installed and args.model not in installed:
            print(f"  ! model '{args.model}' not found. Installed: {sorted(installed)}")
            print(f"    run: ollama pull {args.model}")
            sys.exit(2)
        print(f"Ollama reachable at {args.ollama_url} · model {args.model}")
    except httpx.HTTPError:
        print(f"✗ cannot reach Ollama at {args.ollama_url} — is `ollama serve` running?")
        sys.exit(1)

    output = Path(args.output)
    done: dict[tuple, dict] = {}
    if output.exists():
        text = output.read_text("utf-8").strip()
        existing = [] if not text else json.loads(text)  # tolerate empty/scratch file
        # Resume key = (exact source heading, file, page). Two topics may START on the
        # same page, and an LLM may rename a topic — so only the heading+page is unique.
        done = {
            (d.get("_topic"), d.get("source")): d
            for d in existing
            if d.get("_topic")
        }
        if done:
            print(f"Resuming: {len(done)} articles already in {output}")
        elif existing:
            print("  ! existing output has no '_topic' markers (built by an older version).")
            print("    Run with --backfill-markers once to mark them as done and avoid a rebuild.")

    def topic_key(topic: dict) -> tuple:
        return (topic["title"], f"{topic['source']}, p.{topic['start_page']}")

    # Resolve --book filters up front: a typo'd filename must fail loudly, not
    # silently fall through to "scan every book".
    books: list | None = None
    if args.book:
        books = [b for b in discover_books() if b.name in set(args.book)]
        if not books:
            names = ", ".join(sorted(args.book))
            raise SystemExit(
                f"No PDF in agri-data/ matches: {names}\n"
                f"Available files: {', '.join(b.name for b in discover_books())}"
            )

    topics = extract_all(
        min_words=args.min_words,
        books=books,
    )

    # One-time migration: mark articles saved by older versions as resumed by
    # aligning them (same order, same book/page range) with the detected topics.
    if args.backfill_markers:
        backfill_markers(output, topics)
        return

    queue = topics[: args.limit] if args.limit is not None else topics
    undones = [t for t in queue if topic_key(t) not in done]
    if args.limit is None:
        print(f"\n{len(topics)} topics detected · {len(done)} already done · "
              f"{len(undones)} to process\n")
    else:
        print(f"\n{len(topics)} topics detected · processing first {args.limit} "
              f"({len(undones)} of them are new)\n")

    if not undones:
        print(f"Nothing to do — every topic in this batch is already structured "
              f"({len(done)} articles in {output}).")
        return

    results = list(done.values())
    used_slugs = {d.get("slug") for d in results if d.get("slug")}

    def unique_slug(slug: str) -> str:
        if slug not in used_slugs:
            used_slugs.add(slug)
            return slug
        n = 2
        while f"{slug}-{n}" in used_slugs:
            n += 1
        new = f"{slug}-{n}"
        used_slugs.add(new)
        return new

    new_count = 0
    for i, topic in enumerate(undones, start=1):
        print(f"[{i}/{len(undones)}] {topic['title'][:60]}")
        try:
            article = structure_topic_retry(args.ollama_url, args.model, topic)
        except Exception as exc:  # noqa: BLE001 — one bad topic must not kill the batch
            print(f"  [error] {exc}")
            continue
        if article:
            article["slug"] = unique_slug(article["slug"])
            results.append(article)
            new_count += 1
            out = [
                {k: v for k, v in a.items() if not (args.strip_internal and k == "_topic")}
                for a in results
            ]
            output.write_text(json.dumps(out, indent=2), "utf-8")
            print(f"   -> {article['slug']} ({len(article['sections'])} sections)")
        time.sleep(0.3)  # gentle on the local model / machine

    print(f"\nDone. {new_count} new + {len(done)} already done = "
          f"{len(results)} articles in {output}")
    remaining = len(undones) - new_count
    if remaining > 0:
        print(f"Remaining in this batch: {remaining} "
              f"(rerun the same command to continue where it stopped)")

    print(f"\nDone. {len(results)} articles -> {output}")


if __name__ == "__main__":
    main()