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
    cache_ttl_seconds: int = 3600

    default_provider_base_url: str = "https://api.openai.com/v1"
    default_provider_api_key: str = ""

    session_secret: str = "change-me-to-a-long-random-string"
    session_ttl_seconds: int = 14400

    quality_guard: bool = True
    quality_escalate_threshold: float = 0.62


@lru_cache
def get_settings() -> Settings:
    return Settings()
