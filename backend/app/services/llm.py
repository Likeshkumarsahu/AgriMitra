"""LLM client abstraction for the configured provider.

Groq is the default (with automatic model rotation); Gemini is supported when
`LLM_PROVIDER=gemini`. Pure REST via httpx — the provider key, model, and
timeout come from settings (environment / .env). No provider SDK required.
"""
import logging

import httpx

from app.config import get_settings

log = logging.getLogger("agrimitra.llm")

# models the offset of a Groq key is not allowed to reach (not chat-capable)
_GROQ_SKIP_MARKERS = ("whisper", "guard", "safeguard", "orpheus", "reranker", "embedding")
_GROQ_MODELS_CACHE = {}


class LLMError(Exception):
    pass


def _available_groq_models() -> list[str]:
    """Chat models a key can actually use (from GET /models), cached per key."""
    settings = get_settings()
    key = settings.groq_api_key
    if not key:
        return []
    if key in _GROQ_MODELS_CACHE:
        return _GROQ_MODELS_CACHE[key]
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {key}"},
            )
        if resp.status_code == 200:
            ids = [m.get("id", "") for m in resp.json().get("data", []) if m.get("id")]
            chat = [i for i in ids if not any(mark in i.lower() for mark in _GROQ_SKIP_MARKERS)]
            models = chat or ids
        else:
            models = []
    except Exception:  # noqa: BLE001 — discovery must never break the chain
        models = []
    _GROQ_MODELS_CACHE[key] = models
    return models


def _call_gemini(system: str, messages: list[dict], lang: str) -> str:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_API_KEY is not set")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": m["role"] if m["role"] in ("user", "model") else "user", "parts": [{"text": m["content"]}]} for m in messages],
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 900},
    }
    with httpx.Client(timeout=settings.llm_timeout_s) as client:
        resp = client.post(url, json=payload)
        if resp.status_code != 200:
            raise LLMError(f"Gemini HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LLMError(f"Unexpected Gemini response: {data.get('promptFeedback', data)}") from exc
    return text.strip()


def _call_groq(system: str, messages: list[dict], lang: str) -> str:
    settings = get_settings()
    if not settings.groq_api_key:
        raise LLMError("GROQ_API_KEY is not set")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    candidates = [settings.groq_model]
    candidates += [m for m in _available_groq_models() if m not in candidates]
    last_error: Exception | None = None
    for model in candidates[:3]:
        payload = {
            "model": model,
            "temperature": 0.25,
            "max_tokens": 900,
            "messages": [{"role": "system", "content": system}] + messages,
        }
        with httpx.Client(timeout=settings.llm_timeout_s) as client:
            resp = client.post(url, headers=headers, json=payload)
        if resp.status_code == 200:
            try:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            except (KeyError, IndexError, TypeError) as exc:
                raise LLMError(f"Unexpected Groq response: {data}") from exc
        # 404 model_not_found → the key lacks this model, try the next candidate
        if resp.status_code == 404 and "model" in resp.text.lower():
            last_error = LLMError(f"Groq model '{model}' not accessible for this key")
            log.warning("Groq model %s not accessible — trying another", model)
            continue
        raise LLMError(f"Groq HTTP {resp.status_code}: {resp.text[:200]}")
    raise LLMError(f"All Groq models failed: {last_error}")


def complete(system: str, messages: list[dict], lang: str = "en") -> str:
    """Generate a completion with the configured provider only (no cross-provider fallback).

    Groq transparently rotates through the models a key can actually use
    (see _call_groq). Gemini is used only if LLM_PROVIDER=gemini.
    """
    settings = get_settings()
    if settings.llm_provider == "groq":
        return _call_groq(system, messages, lang)
    if settings.llm_provider == "gemini":
        return _call_gemini(system, messages, lang)
    raise LLMError(f"Unknown llm_provider '{settings.llm_provider}'")