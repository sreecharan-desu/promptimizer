"""NVIDIA embeddings for semantic cache (notebook: nvidia/nemotron-3-embed-1b @ 2048-d)."""

from __future__ import annotations

import asyncio

from openai import OpenAI

from app.core.config import get_settings

NVIDIA_DIM = 2048
DEFAULT_MODEL = "nvidia/nemotron-3-embed-1b"
DEFAULT_BASE = "https://integrate.api.nvidia.com/v1"


def embedding_configured() -> bool:
    settings = get_settings()
    return bool((settings.nvidia_api_key or settings.embedding_api_key or "").strip())


def embedding_dim() -> int:
    settings = get_settings()
    if settings.embedding_dim and settings.embedding_dim > 0:
        return settings.embedding_dim
    return NVIDIA_DIM if embedding_configured() else 256


def _client() -> OpenAI:
    settings = get_settings()
    api_key = (settings.nvidia_api_key or settings.embedding_api_key or "").strip()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY / EMBEDDING_API_KEY required for semantic embeddings")
    base = (settings.embedding_base_url or DEFAULT_BASE).rstrip("/")
    return OpenAI(api_key=api_key, base_url=base, timeout=60.0)


def _embed_sync(text: str) -> list[float]:
    settings = get_settings()
    model = settings.embedding_model or DEFAULT_MODEL
    response = _client().embeddings.create(
        input=text[:8000],
        model=model,
        encoding_format="float",
    )
    vector = response.data[0].embedding if response.data else None
    if not vector:
        raise RuntimeError("Embedding response missing vector")
    return list(vector)


async def embed_query(text: str) -> list[float]:
    trimmed = (text or "").strip()
    dim = embedding_dim()
    if not trimmed:
        return [0.0] * dim
    return await asyncio.to_thread(_embed_sync, trimmed)
