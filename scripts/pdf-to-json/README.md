# PDF → Topic JSON generator

Regenerates the website's topic-level content from the raw textbook PDFs in
`agri-data/`, powering the structured articles the site renders.

## What it does

The site works best when content is **one self-contained topic per article**
(see `data/crops.json` and the `crops` guides for the style). The raw PDFs
have no reliable text markers for these topics, so this pipeline:

1. **`extract_topics.py`** — locally reads character-level **font-weight**
   metadata with `pdfplumber` and treats short, majority-**bold** lines as
   real section headings (numbered list items look like numbered headings, so
   numbering alone can't be trusted). Each heading becomes one topic with its
   page range and raw body text. No network, no API.
2. **`structure_with_llm.py`** — sends each topic to a **local Ollama model**
   (`llama3.2:3b` by default) that rewrites it into the site's display JSON:

```jsonc
{
  "slug": "contour-bunding",
  "title": "Contour Bunding",
  "category": "Sustainability and Environment",
  "definition": "…one clear sentence…",
  "sections": [
    { "heading": "When is it Used", "type": "text", "content": "…" },
    { "heading": "Types", "type": "list", "items": ["…", "…"] },
    { "heading": "Comparison", "type": "table", "rows": [["A", "B"], …] }
  ],
  "source": "Soil-and-Water-Conservation-Engineering-1.pdf, p.18",
  "related": ["rill-erosion", "gully-erosion"]
}
```

`format: "json"` is requested from Ollama so even a small local model emits
structural JSON, and topics whose page contains a real table get the
`pdfplumber.extract_tables()` output instead of the scrambled text interleave.

## Requirements

- Ollama running locally with a chat model:
  ```bash
  ollama serve                        # already running on :11434 by default
  ollama pull llama3.2:3b
  ```
- Python ≥ 3.11 — this folder shares the **project-wide root venv** created by
  `requirements.txt` at the repo root (it also covers the backend and Jupyter):
  ```bash
  # from the repo root
  uv venv && uv pip install -r requirements.txt
  # then run everything below from this folder with the same interpreter
  python extract_topics.py
  ```

## Usage

```bash
# Step 1 — detect topics (read-only, fast)
python extract_topics.py                          # summary of all books
python extract_topics.py --book Soil-and-Water-Conservation-Engineering-1.pdf --out topics.json

# Step 2 — convert a batch into website JSON (uses local LLM)
python structure_with_llm.py --book Soil-and-Water-Conservation-Engineering-1.pdf --output ../../data/structured_topics.json
```

No `--limit` needed: without one it processes **every topic that isn't already
structured** and skips straight past finished work — the same command both
starts a batch and picks up where a stopped run left off. Rerun it any time; it
is idempotent and reports progress:

```
150 topics detected · 97 already done · 53 to process
[1/53] 1.2.4Soil Desurfacing
   -> soil-desurfacing (2 sections)
…
Done. 53 new + 97 already done = 150 articles in data/structured_topics.json
```

### Options

| Flag                   | Applies to | Meaning                                                                 |
| ---------------------- | ---------- | ----------------------------------------------------------------------- |
| `--book NAME`        | both       | Process only that PDF filename (repeatable)                             |
| `--min-words 40`     | both       | Drop topics with fewer body words (removes TOC stubs)                   |
| `--out FILE`         | extract    | Also cache detected topics to a JSON file                               |
| `--limit N`          | LLM        | Optional throttle — process only the first N topics                    |
| `--output FILE`      | LLM        | Output JSON;**resumes** from topics already in it                 |
| `--model`            | LLM        | Ollama model (default`llama3.2:3b`)                                   |
| `--ollama-url`       | LLM        | Default`$OLLAMA_HOST` or `http://localhost:11434`                   |
| `--backfill-markers` | LLM        | One-time: mark articles written by an older version as done (see Notes) |
| `--strip-internal`   | LLM        | Drop the`_topic` resume marker from the JSON (final export only)      |

## Notes

- Uses **only facts present in the source text** — the prompt forbids the model
  from inventing agronomy; un-salvageable topics return `{"skip": true}`.
- The pipeline never sends your textbooks to the cloud; Ollama runs on-device.
- If Ollama drops a connection mid-batch (it occasionally restarts/overloads),
  the script retries each topic automatically (3×, fresh connection) and keeps
  the model loaded between calls (`keep_alive: 10m`).
- Run repeatedly while tuning prompts: rerunning the same command continues
  where it stopped (resume key = exact source heading + page) and only pays for
  new topics. Each saved article has a small `_topic` marker — pass
  `--strip-internal` on the last export to remove it before feeding the data to
  the website.
- Articles written by the version before `_topic` existed can be fixed with one
  `--backfill-markers` run (aligns saved articles to detected topics by source
  file + order and marks them done) — saves redoing finished work.
