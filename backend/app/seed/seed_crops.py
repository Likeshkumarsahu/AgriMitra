"""Seed the MongoDB `crops` collection from data/crops.json.

Usage:  uv run python -m app.seed.seed_crops
"""
import json
import logging
import sys
from pathlib import Path

from app.config import get_settings
from app.db.mongo import get_db

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("seed.crops")


def main():
    data_file = Path(get_settings().data_dir) / "crops.json"
    if not data_file.exists():
        log.error("data/crops.json not found — run `node scripts/build-crops.mjs` first.")
        sys.exit(1)

    db = get_db()
    if db is None:
        log.error("MongoDB is unavailable — check MONGODB_URI / docker-compose. Exiting.")
        sys.exit(1)

    with open(data_file, "r", encoding="utf-8") as fh:
        crops = json.load(fh)

    for crop in crops:
        db["crops"].replace_one({"slug": crop["slug"]}, crop, upsert=True)
    log.info("Seeded %d crops into MongoDB collection `crops`.", len(crops))


if __name__ == "__main__":
    main()