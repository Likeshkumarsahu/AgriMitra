"""RAG chatbot endpoint — persists conversation history."""
import logging

from fastapi import APIRouter

from app import db
from app.models.chat import ChatMessage, ChatSession, utcnow
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag import answer

log = logging.getLogger("agrimitra.chat")
router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(req: ChatRequest):
    reply, sources, llm_fallback = answer(req.message, lang=req.language)

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

    return ChatResponse(session_id=session_id, reply=reply, sources=sources, fallback=llm_fallback)