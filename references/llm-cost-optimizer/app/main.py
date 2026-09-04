from pathlib import Path
from fastapi import FastAPI
from app.api.routes import router
from app.core.providers import ProviderRegistry
from app.services.client_factory import OpenAIClientFactory
from app.services.model_discovery import ModelDiscoveryService

BASE_DIR = Path(__file__).resolve().parents[1]
provider_registry = ProviderRegistry.from_yaml(BASE_DIR / "config" / "providers.yaml")
client_factory = OpenAIClientFactory(provider_registry)
model_discovery = ModelDiscoveryService(client_factory)

app = FastAPI(
    title="LLM Cost Optimizer",
    version="0.1.0",
    description="BYOK OpenAI-compatible model discovery and quality-aware routing foundation.",
)
app.include_router(router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
