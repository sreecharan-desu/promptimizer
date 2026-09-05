from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "info"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_public_url: str = "http://localhost:8000"
    web_origin: str = "http://localhost:3000"

    cache_backend: str = "memory"
    redis_url: str = "redis://localhost:6379/0"
    upstash_redis_url: str = ""
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    cache_ttl_seconds: int = 3600

    default_provider_base_url: str = "https://api.openai.com/v1"
    default_provider_api_key: str = ""

    session_secret: str = "change-me-to-a-long-random-string"
    session_ttl_seconds: int = 14400
    database_url: str = ""
    auth_secret: str = ""
    encryption_key: str = ""

    quality_guard: bool = True
    quality_escalate_threshold: float = 0.62

    # Semantic / Qdrant (NVIDIA nemotron-3-embed-1b @ 2048-d)
    semantic_cache: str = "true"
    semantic_threshold: float = 0.5
    semantic_full_hit: float = 0.88
    semantic_paraphrase_hit: float = 0.62
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "promptimizer_semantic_2048"
    nvidia_api_key: str = ""
    embedding_api_key: str = ""
    embedding_base_url: str = "https://integrate.api.nvidia.com/v1"
    embedding_model: str = "nvidia/nemotron-3-embed-1b"
    embedding_dim: int = 2048
    semantic_backend: str = "python"


@lru_cache
def get_settings() -> Settings:
    return Settings()
