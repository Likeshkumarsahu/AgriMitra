"""Crop catalogue endpoints — reads the MongoDB `crops` collection.

Falls back to the committed data/crops.json if MongoDB is unavailable so the
API stays functional in demos.
"""
import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app import db
from app.config import get_settings

log = logging.getLogger("agrimitra.crops")
router = APIRouter(prefix="/api/crops", tags=["crops"])


def _json_fallback():
    path = Path(get_settings().data_dir) / "crops.json"
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _normalise(crop: dict) -> dict:
    return {"key": crop.get("_id"), **crop}


@router.get("")
def list_crops():
    """List crops (summary fields only)."""
    mongo = db.mongo.get_db()
    if mongo is not None:
        crops = list(mongo["crops"].find({}, {"details": 0}))
        return [{"slug": c["slug"], "name": c["name"], "nameHi": c.get("nameHi", ""), "emoji": c.get("emoji", "🌱"), "categoryName": c.get("categoryName", ""), "states": c.get("states", [])} for c in crops]
    return _json_fallback()


@router.get("/{slug}")
def get_crop(slug: str):
    mongo = db.mongo.get_db()
    if mongo is not None:
        crop = mongo["crops"].find_one({"slug": slug})
        if crop:
            crop.pop("_id", None)
            return crop
        raise HTTPException(status_code=404, detail=f"No crop found with slug '{slug}'")
    fallback = next((c for c in _json_fallback() if c["slug"] == slug), None)
    if not fallback:
        raise HTTPException(status_code=404, detail=f"No crop found with slug '{slug}'")
    return fallback