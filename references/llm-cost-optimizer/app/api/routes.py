from fastapi import APIRouter, HTTPException
from app.core.schemas import LLMRequest, ProviderConnection

router = APIRouter(prefix="/v1", tags=["gateway"])


@router.get("/providers")
def list_providers() -> dict:
    from app.main import provider_registry
    return {"providers": [p.model_dump() for p in provider_registry.list()]}


@router.post("/models/discover")
def discover_models(connection: ProviderConnection) -> dict:
    from app.main import model_discovery
    try:
        models = model_discovery.discover(connection)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Model discovery failed: {exc}") from exc
    return {"models": [m.model_dump(mode="json") for m in models]}


@router.post("/chat")
def chat(request: LLMRequest, connection: ProviderConnection) -> dict:
    raise HTTPException(
        status_code=501,
        detail="Final routing endpoint is intentionally disabled until empirical quality profiles exist.",
    )
