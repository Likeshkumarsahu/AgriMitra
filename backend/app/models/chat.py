"""Chat database models — MongoDB `chat_sessions` + `chat_messages` collections.

Persists the RAG chatbot conversation history per session.
"""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def utcnow():
    return datetime.now(timezone.utc)


class ChatSource(BaseModel):
    course: str
    courseSlug: str
    section: str
    link: str
    snippet: str = ""


class ChatMessage(BaseModel):
    id: Optional[str] = None
    session_id: str
    role: str  # "user" | "assistant"
    content: str
    language: str = "en"
    sources: list[ChatSource] = []
    fallback: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    language: str = "en"
    created_at: datetime = Field(default_factory=utcnow)
    last_message_at: datetime = Field(default_factory=utcnow)