"""Health & status endpoint."""
from fastapi import APIRouter

from app import db
from app.config import get_settings
from app.services.ml_model import model_is_ready

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health():
    settings = get_settings()
    mongodb_up = db.mongo.is_available()
    chroma_up = False
    try:
        db.chroma.get_collection()
        chroma_up = True
    except Exception:  # noqa: BLE001
        chroma_up = False

    ml_ready = model_is_ready()
    return {
        "status": "ok",
        "services": {
            "mongo": "up" if mongodb_up else "down",
            "chroma": "up" if chroma_up else "down",
            "llm_provider": settings.llm_provider,
            "llm_configured": bool(settings.llm_api_key),
            "embedding": f"{settings.embedding_provider}/{settings.embedding_model}",
            "crop_model": "ml-randomforest-v1" if ml_ready else "rule-based-v1",
        },
        "model_version": "ml-randomforest-v1" if ml_ready else "rule-based-v1",
        "environment": settings.environment,
    }