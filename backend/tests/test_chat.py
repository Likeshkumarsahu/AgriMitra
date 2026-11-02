from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api import chat as chat_api
from app.models.chat import ChatSource


def _fake_answer(message: str, lang: str = "en"):
    source = ChatSource(
        course="Introductory Agriculture",
        courseSlug="introductory-agriculture",
        section="Soil Nutrients",
        link="/courses/introductory-agriculture#soil-nutrients",
        snippet="Nitrogen, phosphorus and potassium are primary nutrients.",
    )
    return "NPK means nitrogen, phosphorus and potassium.", [source], False, True


def test_chat_returns_sources_and_grounded_flag(client: TestClient, monkeypatch):
    monkeypatch.setattr(chat_api, "answer", _fake_answer)

    response = client.post("/api/chat", json={"message": "What is NPK?", "language": "en"})

    assert response.status_code == 200
    data = response.json()
    assert data["grounded"] is True
    assert data["fallback"] is False
    assert data["sources"][0]["link"].startswith("/courses/")
    assert data["session_id"]


def test_chat_returns_503_when_llm_and_retrieval_both_fail(client: TestClient, monkeypatch):
    monkeypatch.setattr(
        chat_api,
        "answer",
        lambda message, lang="en": ("Service unavailable", [], True, False),
    )

    response = client.post("/api/chat", json={"message": "What is NPK?"})

    assert response.status_code == 503
    assert response.json()["message"] == "Service unavailable"


def test_chat_rate_limit_returns_429(client: TestClient, monkeypatch):
    monkeypatch.setattr(chat_api, "answer", _fake_answer)
    monkeypatch.setattr(
        chat_api,
        "get_settings",
        lambda: SimpleNamespace(chat_rate_limit=1, chat_rate_window_s=60),
    )

    first = client.post("/api/chat", json={"message": "What is NPK?"})
    second = client.post("/api/chat", json={"message": "What is NPK?"})

    assert first.status_code == 200
    assert second.status_code == 429
    assert "Retry-After" in second.headers
