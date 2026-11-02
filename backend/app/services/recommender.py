"""Crop recommendation engine.

Primary path: trained scikit-learn model (RandomForest over the merged crop
dataset). Fallback: rule-based "distance to ideal range" heuristic over the
22-crop knowledge base. Both paths return the same CropHit contract so the
frontend and API never change.
"""
import json
import logging
from pathlib import Path

from app.config import get_settings
from app.models.query import CropHit, RecommendationResult
from app.services import ml_model

log = logging.getLogger("agrimitra.recommender")

RULE_MODEL_VERSION = "rule-based-v1"
ML_MODEL_VERSION = "ml-randomforest-v1"

PARAMS = ["n", "p", "k", "temperature", "humidity", "ph", "rainfall"]
WEIGHTS = {
    "n": 0.15,
    "p": 0.10,
    "k": 0.10,
    "temperature": 0.20,
    "humidity": 0.15,
    "ph": 0.10,
    "rainfall": 0.20,
}

# region affinity bonus: extra confidence for crops the user's location favours
REGION_BONUS = 8.0


def load_crop_base() -> list[dict]:
    """Load the 22-crop knowledge base from the committed data file."""
    path = Path(get_settings().data_dir) / "crops.json"
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _fit_score(inputs: dict[str, float], crop: dict) -> dict[str, float]:
    """Per-parameter fit in [0,1]: 1 inside the range, decays outside."""
    cond = crop["conditions"]
    scores: dict[str, float] = {}
    for param in PARAMS:
        r = cond[param]
        value = inputs[param]
        lo, hi = float(r["min"]), float(r["max"])
        span = max(hi - lo, 1e-6)
        if lo <= value <= hi:
            scores[param] = 1.0
        else:
            gap = (lo - value) if value < lo else (value - hi)
            scores[param] = max(0.0, 1.0 - gap / (span * 2))
    return scores


def rank_rules(inputs: dict[str, float], crop_base: list[dict]) -> list[tuple[dict, float, dict[str, float]]]:
    """Rule-based ranking over the knowledge base. For explanation + fallback."""
    ranked = []
    for crop in crop_base:
        scores = _fit_score(inputs, crop)
        confidence = sum(WEIGHTS[p] * scores[p] for p in PARAMS) * 100.0
        ranked.append((crop, confidence, scores))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked


def recommend(inputs: dict[str, float], location: str = "", language: str = "en", top_k: int = 6) -> RecommendationResult:
    """Return the top-k recommended crops.

    `inputs` keys: n, p, k, temperature, humidity, ph, rainfall.
    """
    crop_base = load_crop_base()
    loc = location.strip().lower()
    warnings: list[str] = []

    # --- primary: trained ML classifier ---
    ml_ranked, coverage = ml_model.predict(inputs, crop_base)
    using_ml = len(ml_ranked) > 0

    if using_ml:
        version = ML_MODEL_VERSION
        if coverage < 50:
            warnings.append(
                f"Only {coverage:.1f}% of the model's probability mass maps to crops "
                "with a full guide — treat these picks as suggestions, not certainty."
            )
        # per-parameter fit from the rule engine explains each ML pick
        for entry in ml_ranked:
            entry["scores"] = _fit_score(inputs, entry["crop"])
        ranked = ml_ranked[:top_k]
    else:
        # --- fallback: rule-based scoring ---
        version = RULE_MODEL_VERSION
        coverage = None
        warnings.append(
            "Trained model not available — results from the rule-based engine."
        )
        ranked_rules = rank_rules(inputs, crop_base)
        ranked = [
            {"crop": crop, "confidence": conf, "scores": scores}
            for crop, conf, scores in ranked_rules[:top_k]
        ]

    # region affinity bonus (applies to both paths)
    results = []
    for entry in ranked:
        crop = entry["crop"]
        confidence = entry["confidence"]
        if loc and any(loc in s.lower() or s.lower() in loc for s in crop.get("states", [])):
            confidence = min(100.0, confidence + REGION_BONUS)
        results.append(
            CropHit(
                id=crop["id"],
                slug=crop["slug"],
                name=crop["name"],
                nameHi=crop.get("nameHi", crop["name"]),
                emoji=crop.get("emoji", "🌱"),
                categoryName=crop.get("categoryName", ""),
                confidence=round(confidence, 1),
                rawProbability=(
                    round(entry["proba"], 6) if using_ml and entry.get("proba") is not None else None
                ),
                scores={p: round(min(100.0, entry["scores"].get(p, 0.0) * 100), 1) for p in PARAMS},
            )
        )

    results.sort(key=lambda c: c.confidence, reverse=True)

    if loc:
        warnings.append(f"Included state match ({location}) affinity in scoring.")
    if max((c.confidence for c in results), default=0) < 35:
        warnings.append(
            "Your inputs fall outside the ideal range of most crops — "
            "recommendations are for reference only."
        )

    return RecommendationResult(
        recommendations=results,
        modelVersion=version,
        coverage=round(coverage, 2) if coverage is not None else None,
        warnings=warnings,
    )