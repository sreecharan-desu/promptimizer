"""NVIDIA embeddings — notebook style: OpenAI client + get_embedding()."""

from __future__ import annotations

import asyncio

from openai import OpenAI

from app.core.config import get_settings

NVIDIA_DIM = 2048
DEFAULT_MODEL = "nvidia/nemotron-3-embed-1b"
DEFAULT_BASE = "https://integrate.api.nvidia.com/v1"

_openai: OpenAI | None = None


def embedding_configured() -> bool:
    settings = get_settings()
    return bool((settings.nvidia_api_key or settings.embedding_api_key or "").strip())


def embedding_dim() -> int:
    settings = get_settings()
    if settings.embedding_dim and settings.embedding_dim > 0:
        return settings.embedding_dim
    return NVIDIA_DIM if embedding_configured() else 256


def _openai_client() -> OpenAI:
    """Notebook: OpenAI(base_url=NVIDIA Integrate, api_key=NVIDIA_API_KEY)."""
    global _openai
    if _openai is not None:
        return _openai
    settings = get_settings()
    api_key = (settings.nvidia_api_key or settings.embedding_api_key or "").strip()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY / EMBEDDING_API_KEY required for semantic embeddings")
    base = (settings.embedding_base_url or DEFAULT_BASE).rstrip("/")
    _openai = OpenAI(api_key=api_key, base_url=base, timeout=60.0)
    return _openai


def get_embedding(text: str, model: str | None = None) -> list[float]:
    """Notebook cell: openai.embeddings.create(input=text, model=...).data[0].embedding"""
    trimmed = (text or "").strip()
    dim = embedding_dim()
    if not trimmed:
        return [0.0] * dim
    settings = get_settings()
    use_model = model or settings.embedding_model or DEFAULT_MODEL
    response = _openai_client().embeddings.create(
        input=trimmed[:8000],
        model=use_model,
    )
    return list(response.data[0].embedding)


async def embed_query(text: str) -> list[float]:
    return await asyncio.to_thread(get_embedding, text)
