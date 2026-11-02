"""API request/response schemas for the RAG chatbot."""
from pydantic import BaseModel, Field

from app.models.chat import ChatSource


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: str | None = Field(default=None, max_length=64)
    language: str = Field(default="en", pattern="^(en|hi)$")


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    sources: list[ChatSource] = []
    fallback: bool = Field(
        default=False, description="True when LLM was unreachable and snippets were returned"
    )
    grounded: bool = Field(
        default=False,
        description="True when the reply was based on retrieved course-library chunks",
    )