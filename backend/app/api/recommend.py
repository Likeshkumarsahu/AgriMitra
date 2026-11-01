"""Crop recommendation endpoint."""
import logging

from fastapi import APIRouter

from app import db
from app.models.chat import utcnow
from app.models.query import RecommendationQueryRecord
from app.schemas.recommend import RecommendRequest, RecommendResponse
from app.services.recommender import recommend

log = logging.getLogger("agrimitra.recommend")
router = APIRouter(prefix="/api/recommend", tags=["recommend"])


@router.post("", response_model=RecommendResponse)
def run_recommendation(req: RecommendRequest):
    inputs = {
        "n": req.n,
        "p": req.p,
        "k": req.k,
        "temperature": req.temperature,
        "humidity": req.humidity,
        "ph": req.ph,
        "rainfall": req.rainfall,
    }
    result = recommend(inputs, location=req.location, language=req.language)

    # persist audit record (best-effort; never blocks the response)
    try:
        mongo = db.mongo.get_db()
        if mongo is not None:
            record = RecommendationQueryRecord(inputs=req.model_dump(), results=result.model_dump())
            mongo["recommendation_queries"].insert_one(record.model_dump(mode="json"))
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to persist recommendation query: %s", exc)

    return RecommendResponse(**result.model_dump())