"""MongoDB client + collection registry.

If MongoDB is unreachable the app keeps running in "degraded" mode:
the recommendation / chat APIs still work but persistence is skipped
(and the client logs a warning once).
"""
import logging

from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

from app.config import get_settings

log = logging.getLogger("agrimitra.mongo")

_client: MongoClient | None = None
_available: bool | None = None


def get_db():
    """Return the Mongo database handle, or None if unavailable."""
    global _client, _available
    if _client is None and _available is not False:
        try:
            _client = MongoClient(get_settings().mongodb_uri, serverSelectionTimeoutMS=3000)
            _client.admin.command("ping")
            _available = True
            db = _client[get_settings().mongodb_db]
            _ensure_indexes(db)
            log.info("MongoDB connected: %s", get_settings().mongodb_db)
        except (Exception, ServerSelectionTimeoutError) as exc:  # noqa: BLE001
            if _client is not None:
                try:
                    _client.close()
                except Exception:  # noqa: BLE001
                    pass
            _client = None
            _available = False
            log.warning("MongoDB unavailable — running without persistence: %s", exc)
    return _client[get_settings().mongodb_db] if _client is not None else None


def is_available() -> bool:
    get_db()
    return _available is True


def _ensure_indexes(db):
    db["crops"].create_index("slug", unique=True)
    db["chat_messages"].create_index([("session_id", 1), ("created_at", 1)])
    db["recommendation_queries"].create_index([("created_at", -1)])


def close():
    global _client, _available
    if _client is not None:
        _client.close()
    _client = None
    _available = None