import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Allow `pytest` from the repo root without requiring PYTHONPATH.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api import chat as chat_api  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    # Keep tests hermetic: no MongoDB connection attempts and no shared limiter state.
    monkeypatch.setattr(chat_api.db.mongo, "get_db", lambda: None)
    with chat_api._CHAT_HITS_LOCK:
        chat_api._CHAT_HITS.clear()
    return TestClient(app)
