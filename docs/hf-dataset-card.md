---
license: other
language:
  - en
pretty_name: AgriMitra Agriculture Corpus
task_categories:
  - text-generation
  - question-answering
tags:
  - agriculture
  - agronomy
  - education
  - rag
  - crop-recommendation
size_categories:
  - n<1K
---

# AgriMitra Agriculture Corpus

This dataset backs the **AgriMitra** learning platform: a searchable agriculture
library with structured course topics, a crop knowledge base, and a retrieval-
augmented chatbot.

The repository contains **36 source PDFs** at the root and **20 generated JSON
exports** under `json/`. The source Markdown used by the web app lives in the
[GitHub repository](https://github.com/Likeshkumarsahu/AgriMitra).

## Structure

```text
.
├── *.pdf                       # 36 agriculture course PDFs
└── json/
    ├── index.json              # course index / metadata
    ├── crops.json              # 22 crops × 15 guide sections
    ├── topics.json             # structured reader topics
    ├── chatbot-index.json      # RAG/keyword search chunks
    └── *_topic_level_*.json    # 16 normalized topic exports
```

## Source and pipeline

The PDFs are agriculture course material collected for this educational project.
The JSON exports are generated from those PDFs with the scripts in
`scripts/pdf-to-json/` and `scripts/build-*.mjs`:

1. extract text/headings from the PDFs;
2. normalize topic exports into `topics.json`;
3. build the 22-crop guide (`crops.json`);
4. chunk the corpus into `chatbot-index.json` for RAG and keyword fallback.

The crop classifier is published separately at
[`logicmatters06/agrimitra-crop-model`](https://huggingface.co/logicmatters06/agrimitra-crop-model).
Its 6,596-row training CSV lives in the GitHub repository under `crop-ml/`.

## Rights and licence

**The source PDFs remain the property of their original authors and publishers.**
This project does not claim ownership of them and does not relicense them. They are
shared here for educational and research access only. If you are a rights holder
and want a file corrected or removed, please open a discussion on this repository
and it will be actioned promptly.

Project-created metadata and JSON annotations are released under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the source PDFs are
excluded from that grant. Verify the rights of each original document before
redistributing it elsewhere.

## Usage

```bash
# PDFs only
hf download logicmatters06/agrimitra-dataset \
  --type dataset --include "*.pdf" --local-dir agri-data

# JSON exports only
hf download logicmatters06/agrimitra-dataset \
  --type dataset --include "json/*" --local-dir /tmp/agrimitra-json
```

See the [AgriMitra README](https://github.com/Likeshkumarsahu/AgriMitra) for the
full setup and rebuild instructions.

## Attribution

If you use the corpus, cite the AgriMitra project and the original authors of the
individual course documents. The 22 base crop classes in the merged classifier
dataset correspond to the widely used public Kaggle Crop Recommendation dataset;
the remaining 29 classes are additional Indian crop records compiled for this
project.
