"""Trained crop classification model (scikit-learn RandomForest).

Artifact: crop-ml/crop_recommendation_model.pkl
Trained on the merged crop dataset (51 labels) via trainingModel.ipynb.
Feature order: N, P, K, temperature, humidity, ph, rainfall.
"""
import logging
import warnings
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.config import get_settings

log = logging.getLogger("agrimitra.ml")

FEATURES = ["n", "p", "k", "temperature", "humidity", "ph", "rainfall"]

# Model label -> AgriMitra crop slug (our 22-crop knowledge base). Labels
# outside this map (wheat, tomato, ...) are still predicted by the trained
# model but have no 15-section guide here, so they are not recommended.
LABEL_TO_SLUG = {
    "apple": "apple",
    "banana": "banana",
    "blackgram": "blackgram",
    "chickpea": "chickpea",
    "coconut": "coconut",
    "coffee": "coffee",
    "cotton": "cotton",
    "grapes": "grapes",
    "jute": "jute",
    "kidneybeans": "kidneybeans",
    "lentil": "lentil",
    "maize": "maize",
    "mango": "mango",
    "mothbeans": "mothbeans",
    "mungbean": "mungbean",
    "muskmelon": "muskmelon",
    "orange": "orange",
    "papaya": "papaya",
    "pigeonpeas": "pigeonpea",
    "pigeonpea": "pigeonpea",
    "pomegranate": "pomegranate",
    "rice": "rice",
    "watermelon": "watermelon",
}


@lru_cache(maxsize=1)
def load_model():
    """Load and cache the joblib model. Returns None when unavailable."""
    settings = get_settings()
    path = Path(settings.crop_model_path)
    if not path.exists():
        log.warning("Crop model not found at %s — falling back to rule engine", path)
        return None
    try:
        import joblib

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # sklearn re-training/inconsistent-version notices
            model = joblib.load(path)
        log.info("Crop model loaded from %s (%s)", path.name, type(model).__name__)
        return model
    except Exception as exc:  # noqa: BLE001
        log.warning("Failed to load crop model: %s — falling back to rule engine", exc)
        return None


def model_is_ready() -> bool:
    return load_model() is not None


def predict(inputs: dict[str, float], crop_base: list[dict]) -> list[dict]:
    """Rank crops with the trained classifier.

    `crop_base` restricts the output to crops with a knowledge-base entry.
    Returns a list of {crop, confidence(0-100), proba} sorted by confidence.
    """
    model = load_model()
    if model is None:
        return []

    labels = list(model.classes_)
    feature = [float(inputs.get(f, 0.0)) for f in FEATURES]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        probs = model.predict_proba([feature])[0]  # one distribution over all labels

    known = {}
    for label, proba in zip(labels, probs):
        slug = LABEL_TO_SLUG.get(label)
        if slug and proba > 0:
            known[slug] = max(known.get(slug, 0.0), float(proba))

    total = sum(known.values()) or 1e-9
    base = {c["slug"]: c for c in crop_base}

    ranked = []
    for slug, proba in known.items():
        crop = base.get(slug)
        if crop is None:
            continue
        ranked.append(
            {"crop": crop, "confidence": round(proba / total * 100.0, 2), "proba": proba}
        )
    ranked.sort(key=lambda r: r["confidence"], reverse=True)
    return ranked


def describe() -> str:
    model = load_model()
    if model is None:
        return "unavailable"
    return f"{type(model).__name__.lower()}(estimators={model.n_estimators})"