"""extract_topics.py — groups raw textbook PDF text into topic units.

The website content is organised as small self-contained topic articles
({slug, title, category, definition, sections, source, related}). Each
article should cover ONE real section heading of a source book — e.g.
"Contour Bunding", "Sheet Erosion".

Finding those headings in these PDFs cannot be done by matching numbered
lines: numbered list items ("1. Select File", "2. Add rows…") look exactly
like numbered headings. What actually distinguishes a heading is FONT
WEIGHT — headings are set in bold, body text is not. That metadata lives in
the PDF's character-level data, so we read it directly instead of guessing
from the text.

This script is purely local: no API, no network. Each detected topic is
{title, source, start_page, end_page, raw_text} — the exact input the LLM
restructuring step (structure_with_llm.py) turns into a website-ready JSON
article.

Usage:
    uv run python extract_topics.py                     # detect + print summary
    uv run python extract_topics.py --out topics.json   # also cache the topics
"""

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber

# agri-data/ lives one level above this folder (scripts/pdf-to-json/ → repo root).
ROOT = Path(__file__).resolve().parents[2]
AGRI_DATA = Path(__import__("os").environ.get("AGRIDATA_DIR", ROOT / "agri-data"))

PAGE_NUM_ONLY_RE = re.compile(r"^\s*\d+\s*$")

# Titles that are structurally TOC/index/cover junk — never real topics even
# though the original PDF sets them in bold (e.g. the contents table whose bold
# row reads "SN  Tittle  Page No").
JUNK_TITLE_RE = re.compile(
    r"^(table\s+of\s+contents?|contents?|index|references?|bibliography|abbreviations?"
    r"|foreword|preface|acknowledg(ement|ements)|list\s+of\s+(tables|figures)"
    r"|sn\s*[\w\s]*page\s+no|fig[a-z]*[.]?[ ]*[0-9.]*[ ]*[a-z])",
    re.IGNORECASE,
)


def is_junk_title(title: str) -> bool:
    t = title.strip().lower()
    return bool(JUNK_TITLE_RE.match(t)) or "page no" in t


def is_bold(fontname: str) -> bool:
    """Bold detection from the PDF font name (Bold/Black/Demi/BoldItalic etc.)."""
    name = (fontname or "").lower()
    return any(k in name for k in ("bold", "black", "demi", "heavy", "semi-bold", "-bo"))


# ---------------------------------------------------------------------------
# 1. Extract lines with bold-ness, tagged with page number
# ---------------------------------------------------------------------------

def extract_lines(path: Path) -> list[tuple[int, str, bool]]:
    """Return (page_num, line_text, is_heading_candidate) for one PDF."""
    lines: list[tuple[int, str, bool]] = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            by_top: dict[float, list] = {}
            for c in page.chars:
                by_top.setdefault(round(c["top"], 1), []).append(c)
            for top in sorted(by_top.keys()):
                chars = by_top[top]
                text = "".join(c["text"] for c in chars).strip()
                if not text or PAGE_NUM_ONLY_RE.match(text) or len(text) <= 2:
                    continue
                non_space = [c for c in chars if c["text"].strip()]
                if not non_space:
                    continue
                bold_frac = sum(1 for c in non_space if is_bold(c["fontname"])) / len(non_space)
                # short + majority-bold line = heading candidate
                heading_candidate = bold_frac > 0.6 and len(text.split()) <= 12
                lines.append((i, text, heading_candidate))
    return lines


# ---------------------------------------------------------------------------
# 2. Drop running headers/footers that repeat across many pages
# ---------------------------------------------------------------------------

def strip_boilerplate(lines: list[tuple[int, str, bool]]) -> list[tuple[int, str, bool]]:
    counts = Counter(ln for _, ln, _ in lines)
    total_pages = len(set(p for p, _, _ in lines)) or 1
    boilerplate = {
        ln for ln, c in counts.items()
        if c >= max(3, total_pages * 0.25) and len(ln) < 80
    }
    return [(p, ln, h) for p, ln, h in lines if ln not in boilerplate]


# ---------------------------------------------------------------------------
# 3. Split into topics at bold heading lines (merging multi-line headings)
# ---------------------------------------------------------------------------

def split_into_topics(lines: list[tuple[int, str, bool]], source: str,
                      min_words: int = 40) -> list[dict]:
    topics: list[dict] = []
    current_title_parts: list[str] = []
    current_start_page: int | None = None
    current_body: list[str] = []
    body_last_page: list[int | None] = [None]

    def flush():
        if current_title_parts and current_body:
            title = " ".join(current_title_parts).strip(" .:-")
            word_count = sum(len(b.split()) for b in current_body)
            if not is_junk_title(title) and word_count >= min_words:
                topics.append({
                    "title": title,
                    "source": source,
                    "start_page": current_start_page,
                    "end_page": body_last_page[0] or current_start_page,
                    "raw_text": " ".join(current_body),
                })

    prev_was_heading = False
    for page_num, ln, is_heading in lines:
        if is_heading:
            if not prev_was_heading:
                flush()
                current_start_page = page_num
                current_body = []
                current_title_parts = [ln]
            else:
                current_title_parts.append(ln)  # heading continues on next line
        else:
            current_body.append(ln)
            body_last_page[0] = page_num
        prev_was_heading = is_heading
    flush()
    return topics


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def discover_books() -> list[Path]:
    if not AGRI_DATA.is_dir():
        raise SystemExit(f"Dataset dir not found: {AGRI_DATA}")
    return sorted(p for p in AGRI_DATA.glob("*.pdf") if p.name.lower().endswith(".pdf"))


def extract_all(books: list[Path] | None = None, min_words: int = 40) -> list[dict]:
    books = books or discover_books()
    all_topics: list[dict] = []
    for path in books:
        try:
            lines = strip_boilerplate(extract_lines(path))
        except Exception as exc:  # noqa: BLE001 — a bad PDF must not kill the batch
            print(f"  ! {path.name}: extraction failed: {exc}")
            continue
        topics = split_into_topics(lines, source=path.name, min_words=min_words)
        all_topics.extend(topics)
        print(f"{path.name}: {len(topics)} topics")
    return all_topics


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--book", action="append", default=None,
                    help="Only process this PDF filename (repeatable; default: all)")
    ap.add_argument("--min-words", type=int, default=40,
                    help="Minimum body word count for a topic to be kept (default 40)")
    ap.add_argument("--out", default=None, help="Also cache topics to this JSON file")
    args = ap.parse_args()

    books = discover_books()
    if args.book:
        names = set(args.book)
        books = [b for b in books if b.name in names]
        if not books:
            raise SystemExit(
                f"No PDF in agri-data/ matches: {', '.join(sorted(args.book))}\n"
                f"Available files: {', '.join(b.name for b in discover_books())}"
            )
        print(f"Filtering to {len(books)} requested book(s)\n")
    else:
        print(f"Found {len(books)} PDFs in {AGRI_DATA}\n")

    topics = extract_all(books, min_words=args.min_words)
    print(f"\nTotal topics across all books: {len(topics)}\n")
    print("Sample of detected topics:\n")
    for t in topics[:15]:
        print(f"  [{t['source']} p.{t['start_page']}-{t['end_page']}] "
              f'"{t["title"]}" ({len(t["raw_text"].split())} words)')

    if args.out:
        Path(args.out).write_text(json.dumps(topics, indent=2), "utf-8")
        print(f"\nAll topics cached -> {args.out}")


if __name__ == "__main__":
    main()