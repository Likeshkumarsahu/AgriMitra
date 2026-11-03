from fastapi.testclient import TestClient

from app.services import recommender

VALID_PAYLOAD = {
    "n": 90,
    "p": 50,
    "k": 50,
    "temperature": 27,
    "humidity": 75,
    "ph": 6.5,
    "rainfall": 1200,
    "location": "Punjab",
    "language": "en",
}


def test_recommend_returns_ranked_crops(client: TestClient):
    response = client.post("/api/recommend", json=VALID_PAYLOAD)

    assert response.status_code == 200
    data = response.json()
    assert data["recommendations"]
    assert data["modelVersion"] in {"ml-randomforest-v1", "rule-based-v1"}
    assert isinstance(data["warnings"], list)
    assert 0 <= len(data["recommendations"]) <= 6
    for hit in data["recommendations"]:
        assert hit["slug"]
        assert 0 <= hit["confidence"] <= 100
        assert set(hit["scores"]) == {"n", "p", "k", "temperature", "humidity", "ph", "rainfall"}


def test_recommend_requires_every_numeric_field(client: TestClient):
    payload = dict(VALID_PAYLOAD)
    payload.pop("humidity")

    response = client.post("/api/recommend", json=payload)

    assert response.status_code == 422


def test_recommend_rejects_out_of_range_values(client: TestClient):
    for field, value in (("ph", 15), ("humidity", 101), ("temperature", 100)):
        payload = dict(VALID_PAYLOAD)
        payload[field] = value
        response = client.post("/api/recommend", json=payload)
        assert response.status_code == 422, field


def test_recommend_requires_location(client: TestClient):
    payload = dict(VALID_PAYLOAD)
    payload["location"] = ""

    response = client.post("/api/recommend", json=payload)

    assert response.status_code == 422


def test_low_coverage_adds_warning(monkeypatch):
    crop = {
        "id": "rice",
        "slug": "rice",
        "name": "Rice",
        "nameHi": "चावल",
        "emoji": "🌾",
        "categoryName": "Cereal",
        "states": [],
        "conditions": {
            param: {"min": 0, "max": 100} for param in recommender.PARAMS
        },
    }
    ranked = [{"crop": crop, "confidence": 12.5, "proba": 0.125, "scores": {}}]
    monkeypatch.setattr(recommender, "load_crop_base", lambda: [crop])
    monkeypatch.setattr(recommender.ml_model, "predict", lambda inputs, base: (ranked, 12.5))

    result = recommender.recommend(
        {param: 50.0 for param in recommender.PARAMS},
        location="",
    )

    assert result.coverage == 12.5
    assert any("probability mass" in warning for warning in result.warnings)
