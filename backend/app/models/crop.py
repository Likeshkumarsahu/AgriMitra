"""Crop database model — MongoDB `crops` collection.

Source of truth for structured crop details (22 crops × 15 sections).
Seeded from data/crops.json by app/seed/seed_crops.py.
"""
from typing import Optional

from pydantic import BaseModel, Field

SECTION_IDS = [
    "crop-basics",
    "climate",
    "soil",
    "land-preparation",
    "seed-planting-material",
    "sowing-planting",
    "water-irrigation",
    "nutrients",
    "weeds",
    "pests",
    "diseases",
    "growth-management",
    "monitoring",
    "harvest-post-harvest",
    "economics-marketing",
]


class CropConditionRange(BaseModel):
    min: float
    max: float


class CropConditions(BaseModel):
    n: CropConditionRange
    p: CropConditionRange
    k: CropConditionRange
    temperature: CropConditionRange
    humidity: CropConditionRange
    ph: CropConditionRange
    rainfall: CropConditionRange


class CropDetail(BaseModel):
    id: str
    title: str
    content: str


class Crop(BaseModel):
    id: str
    slug: str
    name: str
    name_hi: str = Field(alias="nameHi")
    emoji: str = "🌱"
    scientific_name: str = Field(alias="scientificName")
    family: str
    category: str
    category_name: str = Field(alias="categoryName")
    states: list[str] = []
    duration: str = ""
    conditions: CropConditions
    details: list[CropDetail] = []

    class Config:
        populate_by_name = True