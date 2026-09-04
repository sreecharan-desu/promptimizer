from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Promptimizer API",
    version="0.1.0",
    description=(
        "Quality-aware LLM router. Bring your own OpenAI-compatible key, "
        "classify difficulty, route to the cheapest adequate model, cache "
        "repeated prompts, and measure cost saved without silently dropping quality."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

origins = {settings.web_origin, "http://localhost:3000", "http://127.0.0.1:3000"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "Promptimizer",
        "docs": "/docs",
        "health": "/health",
        "openai_compat": "/v1/chat/completions",
    }
