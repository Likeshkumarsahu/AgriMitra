"""Build the RAG corpus: chunk data/courses/*.md and ingest into ChromaDB.

Embeddings use the local `all-MiniLM-L6-v2` sentence-transformers model via
ONNX (see db/chroma.py), so no API key or network is needed after the first
model download. Set EMBEDDING_PROVIDER=gemini to embed through the Gemini API.

Usage:  uv run python -m app.seed.ingest_docs [--recreate]
"""
import logging
import re
import string
import sys

from app.db.chroma import get_collection
from app.config import get_settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("seed.ingest")


def chunk_markdown(md: str, course_title: str, slug: str) -> list[tuple[str, str, dict]]:
    """Split a course markdown file into sections.

    Returns (chunk_text, chunk_id, metadata) for each heading block.
    """
    body = re.sub(r"^---.*?---\s*", "", md, flags=re.S)
    lines = body.split("\n")
    blocks: list[tuple[str, str]] = []  # (heading, text)
    current_heading = "Overview"
    current: list[str] = []

    def flush():
        text = " ".join(current).replace("\u00A0", " ").strip()
        text = re.sub(r"\s+", " ", text)
        if text and len(text) >= 80:
            blocks.append((current_heading, text))
        current.clear()

    for line in lines:
        m = re.match(r"^#{2,4}\s+(.+)$", line)
        if m:
            flush()
            current_heading = re.sub(r"^\d+(\.\d+)*\.?\s*", "", m.group(1)).strip() or "Overview"
        else:
            current.append(line)
    flush()

    chunks = []
    for i, (heading, text) in enumerate(blocks):
        cid = f"{slug}::{i}::{_safe_id(heading)}"
        meta = {"course": course_title, "courseSlug": slug, "section": heading}
        chunks.append((text[:1400], cid, meta))
    return chunks


def _safe_id(text: str) -> str:
    allowed = set(string.ascii_letters + string.digits + "-_")
    return "".join(c if c in allowed else "-" for c in text)[:24]


def main():
    recreate = "--recreate" in sys.argv
    settings = get_settings()

    import json
    from pathlib import Path

    data_dir = Path(settings.data_dir)
    index_file = data_dir / "index.json"
    courses_dir = data_dir / "courses"
    if not index_file.exists():
        log.error("data/index.json missing. Run `node scripts/extract.mjs` first.")
        sys.exit(1)

    collection = get_collection()
    if recreate:
        try:
            collection.delete(where={"ignored": {"$ne": True}}, all=True)
        except Exception:
            pass

    index = json.loads(index_file.read_text(encoding="utf-8"))
    total = 0
    for course in index:
        md_file = courses_dir / f"{course['slug']}.md"
        if not md_file.exists():
            continue
        chunks = chunk_markdown(md_file.read_text(encoding="utf-8"), course["title"], course["slug"])
        if not chunks:
            continue
        ids = [c[1] for c in chunks]
        docs = [c[0] for c in chunks]
        metas = [c[2] for c in chunks]
        collection.upsert(ids=ids, documents=docs, metadatas=metas)
        total += len(chunks)
        log.info("ingested %5d chunks  %-40s", len(chunks), course["slug"])

    log.info("✓ Ingested %d chunks into Chroma collection '%s'", total, settings.chroma_collection)


if __name__ == "__main__":
    main()