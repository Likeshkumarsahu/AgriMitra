"""Recommendation query model — MongoDB `recommendation_queries` collection."""
from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utcnow():
    return datetime.now(timezone.utc)


class RecommendationInput(BaseModel):
    n: float
    p: float
    k: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float
    location: str = ""
    language: str = "en"


class CropHit(BaseModel):
    id: str
    slug: str
    name: str
    nameHi: str
    emoji: str
    categoryName: str
    confidence: float
    scores: dict[str, float] = {}


class RecommendationResult(BaseModel):
    recommendations: list[CropHit] = []
    modelVersion: str = "rule-based-v1"
    generatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: list[str] = []


class RecommendationQueryRecord(BaseModel):
    inputs: RecommendationInput
    results: RecommendationResult
    created_at: datetime = Field(default_factory=utcnow)