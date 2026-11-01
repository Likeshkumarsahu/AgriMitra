"""Central configuration.

All secrets and tunables are read from environment variables (or the .env /
../.env files). Nothing is hardcoded here.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(BACKEND_DIR / ".env"), str(PROJECT_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- AI providers (secrets come from .env) ---
    gemini_api_key: str = ""
    groq_api_key: str = ""

    llm_provider: str = "groq"  # "groq" | "gemini" — only the configured provider is used
    gemini_model: str = "gemini-2.5-flash"
    groq_model: str = "allam-2-7b"  # small+fast; a working chat model is auto-detected if this isn't accessible

    # --- Embeddings ---
    # "local" (all-MiniLM-L6-v2 via ONNX, offline, no key) | "gemini" (API)
    embedding_provider: str = "local"
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- Databases / vector store ---
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "agrimitra"
    chroma_persist_dir: str = str(PROJECT_ROOT / "data" / "chroma")
    chroma_collection: str = "agrimitra_docs"

    # --- App ---
    environment: str = "development"
    data_dir: str = str(PROJECT_ROOT / "data")
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Trained crop model (joblib artifact) ---
    crop_model_path: str = str(
        PROJECT_ROOT / "crop-ml" / "crop_recommendation_model.pkl"
    )

    # --- Timeouts (seconds) ---
    llm_timeout_s: float = 25.0
    retrieval_timeout_s: float = 10.0
    chroma_http_timeout_s: float = 30.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_api_key(self) -> str:
        return self.gemini_api_key if self.llm_provider == "gemini" else self.groq_api_key

    @property
    def llm_model(self) -> str:
        return self.gemini_model if self.llm_provider == "gemini" else self.groq_model


@lru_cache
def get_settings() -> Settings:
    return Settings()