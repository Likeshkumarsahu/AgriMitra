"""API request/response schemas for /recommend."""
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.models.query import CropHit


class RecommendRequest(BaseModel):
    n: float = Field(ge=0, le=300, description="Soil nitrogen (kg/ha or ppm)")
    p: float = Field(ge=0, le=300, description="Soil phosphorus")
    k: float = Field(ge=0, le=300, description="Soil potassium")
    temperature: float = Field(ge=-10, le=55, description="Temperature in °C")
    humidity: float = Field(ge=0, le=100, description="Relative humidity (%)")
    ph: float = Field(ge=0, le=14, description="Soil pH")
    rainfall: float = Field(ge=0, le=3000, description="Annual rainfall (mm)")
    location: str = Field(default="", max_length=120, description="State / region")
    language: str = Field(default="en", pattern="^(en|hi)$")


class RecommendResponse(BaseModel):
    recommendations: list[CropHit]
    modelVersion: str = "rule-based-v1"
    generatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: list[str] = []