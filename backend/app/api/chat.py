"""RAG chatbot endpoint — persists conversation history."""
import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request

from app import db
from app.config import get_settings
from app.models.chat import ChatMessage, ChatSession, utcnow
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag import answer

log = logging.getLogger("agrimitra.chat")
router = APIRouter(prefix="/api/chat", tags=["chat"])

# Lightweight in-process limiter: enough to stop accidental loops / single-client
# abuse. For a multi-worker deployment, put a shared limiter at the proxy layer.
_CHAT_HITS: dict[str, deque[float]] = defaultdict(deque)
_CHAT_HITS_LOCK = threading.Lock()


def _check_rate_limit(request: Request) -> None:
    settings = get_settings()
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _CHAT_HITS_LOCK:
        hits = _CHAT_HITS[client]
        cutoff = now - settings.chat_rate_window_s
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= settings.chat_rate_limit:
            retry_after = max(1, int(settings.chat_rate_window_s - (now - hits[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail="Too many chat requests. Please wait and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    _check_rate_limit(request)
    reply, sources, llm_fallback, grounded = answer(req.message, lang=req.language)

    # A degraded retrieval + LLM outage is a service failure, not a successful
    # chat turn. Return 503 so the BFF/client can show the offline path.
    if llm_fallback and not sources:
        raise HTTPException(status_code=503, detail=reply)

    session_id = req.session_id or ChatSession().id

    # persist (best-effort)
    try:
        mongo = db.mongo.get_db()
        if mongo is not None:
            mongo["chat_sessions"].update_one(
                {"id": session_id},
                {"$setOnInsert": {"id": session_id, "language": req.language, "created_at": utcnow()},
                 "$set": {"last_message_at": utcnow()}},
                upsert=True,
            )
            mongo["chat_messages"].insert_many(
                [
                    ChatMessage(session_id=session_id, role="user", content=req.message, language=req.language).model_dump(mode="json"),
                    ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=reply,
                        language=req.language,
                        sources=sources,
                        fallback=llm_fallback,
                    ).model_dump(mode="json"),
                ]
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to persist chat history: %s", exc)

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        sources=sources,
        fallback=llm_fallback,
        grounded=grounded,
    )