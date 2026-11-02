"""Trained crop classification model (scikit-learn RandomForest).

Artifact: crop-ml/crop_recommendation_model.pkl
Trained on the merged crop dataset (51 labels) via trainingModel.ipynb.
Feature order: N, P, K, temperature, humidity, ph, rainfall.
"""
import logging
import warnings
from functools import lru_cache
from pathlib import Path

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
def _load_model_cached(path: str, mtime_ns: int):
    """Load a model once per file version.

    Exceptions are not cached by lru_cache, so a corrupt/missing artifact can be
    replaced without restarting the API. The mtime key also picks up retrained
    models automatically.
    """
    import joblib
    import sklearn

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model = joblib.load(path)
    # A forest emits the same version warning once per tree; log each distinct
    # message once instead of flooding the startup log with 100+ duplicates.
    for message in {str(warning.message) for warning in caught}:
        log.warning(
            "scikit-learn %s warning while loading %s: %s",
            sklearn.__version__,
            Path(path).name,
            message,
        )
    log.info(
        "Crop model loaded from %s (%s, scikit-learn %s)",
        Path(path).name,
        type(model).__name__,
        sklearn.__version__,
    )
    return model


def load_model():
    """Load and cache the latest joblib model. Returns None when unavailable."""
    settings = get_settings()
    path = Path(settings.crop_model_path)
    if not path.exists():
        log.warning("Crop model not found at %s — falling back to rule engine", path)
        return None
    try:
        mtime_ns = path.stat().st_mtime_ns
        return _load_model_cached(str(path), mtime_ns)
    except Exception as exc:  # noqa: BLE001
        # Do not cache this failure: a later request can retry after the file is fixed.
        log.warning("Failed to load crop model: %s — falling back to rule engine", exc)
        return None


def model_is_ready() -> bool:
    return load_model() is not None


def predict(inputs: dict[str, float], crop_base: list[dict]) -> tuple[list[dict], float]:
    """Rank crops with the trained classifier.

    `crop_base` restricts the output to crops with a knowledge-base entry.
    Returns `(ranked, coverage)` where confidence is the raw model probability
    (0–100, not renormalised over the guide subset) and coverage is the total
    probability mass that maps to crops with a guide.
    """
    model = load_model()
    if model is None:
        return [], 0.0

    estimator = getattr(model, "best_estimator_", model)
    labels = list(estimator.classes_)
    feature = [float(inputs.get(f, 0.0)) for f in FEATURES]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        probs = estimator.predict_proba([feature])[0]  # one distribution over all labels

    known: dict[str, float] = {}
    for raw_label, proba in zip(labels, probs):
        label = str(raw_label).strip().lower()
        slug = LABEL_TO_SLUG.get(label)
        if slug and proba > 0:
            known[slug] = max(known.get(slug, 0.0), float(proba))

    if not known:
        log.warning(
            "No model labels matched LABEL_TO_SLUG; cannot recommend guide crops. "
            "Model labels: %s",
            labels[:10],
        )

    coverage = sum(known.values()) * 100.0
    if known and coverage < 50.0:
        log.warning(
            "Low guide coverage: only %.1f%% of the model's probability mass maps "
            "to crops with a knowledge-base guide",
            coverage,
        )

    base = {c["slug"]: c for c in crop_base}
    ranked = []
    for slug, proba in known.items():
        crop = base.get(slug)
        if crop is None:
            continue
        ranked.append(
            {"crop": crop, "confidence": round(proba * 100.0, 2), "proba": proba}
        )
    ranked.sort(key=lambda r: r["confidence"], reverse=True)
    return ranked, round(coverage, 2)


def describe() -> str:
    model = load_model()
    if model is None:
        return "unavailable"
    # GridSearchCV exposes best_estimator_; Pipeline exposes named_steps.
    estimator = getattr(model, "best_estimator_", model)
    named_steps = getattr(estimator, "named_steps", None)
    if named_steps:
        estimator = list(named_steps.values())[-1]
    return f"{type(estimator).__name__.lower()}(estimators={getattr(estimator, 'n_estimators', 'n/a')})"