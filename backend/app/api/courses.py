"""Course catalogue endpoint — serves the module index (data/index.json)."""
import json
import logging
from pathlib import Path

from fastapi import APIRouter

from app.config import get_settings

log = logging.getLogger("agrimitra.courses")
router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("")
def list_courses():
    path = Path(get_settings().data_dir) / "index.json"
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except OSError as exc:
        log.error("index.json unavailable: %s", exc)
        return []