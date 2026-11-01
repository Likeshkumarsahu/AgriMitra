"""ChromaDB vector store wrapper.

Embeddings default to a local `all-MiniLM-L6-v2` (sentence-transformers) model
served through ONNX Runtime — 384-dim, offline after the first download (cached
under ~/.cache/chroma). Set `EMBEDDING_PROVIDER=gemini` to use the Gemini
embedding API instead: no local model, but requires a valid GEMINI_API_KEY and
a paid/available quota.

Retrieval failures degrade gracefully to keyword search (see services.rag).
"""
import logging
import time

import chromadb
import httpx
from chromadb.utils import embedding_functions as chroma_ef

from app.config import get_settings

log = logging.getLogger("agrimitra.chroma")

_LOCAL_MODEL = "all-MiniLM-L6-v2"


def _embedding_function():
    """Embedding function for the configured provider ('local' | 'gemini')."""
    settings = get_settings()
    if settings.embedding_provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("EMBEDDING_PROVIDER=gemini requires GEMINI_API_KEY")
        return _GeminiEmbeddingFunction()
    return chroma_ef.ONNXMiniLM_L6_V2()


def get_collection():
    """Return the Chroma collection (lazy, persistent)."""
    settings = get_settings()
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return client.get_or_create_collection(
        name=settings.chroma_collection,
        embedding_function=_embedding_function(),
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Gemini embedding function (optional provider, kept for environments without
# onnxruntime or with a generous embedding quota).
# ---------------------------------------------------------------------------

def _gemini_embed_batch(texts: list[str], attempt: int = 1) -> list[list[float]]:
    """Single batchEmbedContents call with exponential backoff for 429/5xx."""
    settings = get_settings()
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.embedding_model}:batchEmbedContents?key={settings.gemini_api_key}"
    )
    payload = {
        "model": f"models/{settings.embedding_model}",
        "requests": [
            {"model": f"models/{settings.embedding_model}", "content": {"parts": [{"text": t}]}}
            for t in texts
        ],
    }
    try:
        with httpx.Client(timeout=settings.llm_timeout_s) as client:
            resp = client.post(url, json=payload)
            if resp.status_code in (429, 500, 502, 503):
                if attempt >= 5:
                    resp.raise_for_status()
                wait = min(2**attempt, 60) + (attempt * 2)
                log.warning("embed 429/5xx (attempt %d) — backing off %ss", attempt, wait)
                time.sleep(wait)
                return _gemini_embed_batch(texts, attempt + 1)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if attempt < 5:
            wait = min(2**attempt, 60) + (attempt * 2)
            log.warning("embed HTTP %s (attempt %d) — backing off %ss", exc.response.status_code, attempt, wait)
            time.sleep(wait)
            return _gemini_embed_batch(texts, attempt + 1)
        raise
    data = resp.json()
    return [e["values"] for e in data["embeddings"]]


def _gemini_embed(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings via the Gemini embedding REST API."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set; cannot embed")
    out: list[list[float]] = []
    for i in range(0, len(texts), 64):
        out.extend(_gemini_embed_batch(texts[i : i + 64]))
        if i + 64 < len(texts):
            time.sleep(0.35)  # gentle pacing to respect the embedding quota
    return out


class _GeminiEmbeddingFunction(chromadb.EmbeddingFunction):
    """Chroma embedding function backed by the Gemini embedding API."""

    def __call__(self, input):
        return _gemini_embed(input)