#!/usr/bin/env python3
"""Smoke-test Python Qdrant semantic cache with NVIDIA 2048-d embeddings."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=True)

from app.core.config import get_settings
from app.domain.embeddings import embed_query, embedding_dim
from app.domain.semantic_cache import (
    collection_name,
    ensure_collection,
    find_similar,
    qdrant_configured,
    remember_semantic,
)


async def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    print("configured", qdrant_configured())
    print("url", bool(settings.qdrant_url))
    print("nvidia", bool(settings.nvidia_api_key or settings.embedding_api_key))
    print("collection", collection_name())
    print("dim", embedding_dim())
    if not qdrant_configured():
        print("FAIL: Qdrant/NVIDIA not configured")
        return 1

    ensure_collection()
    print("collection ready")

    vec = await embed_query("What is 17 * 24?")
    print("embed_len", len(vec))
    assert len(vec) == 2048, len(vec)

    owner = "py-smoke-owner"
    await remember_semantic(
        prompt="What is 17 * 24?",
        answer="408",
        model="test",
        tier="economy",
        quality=0.95,
        owner=owner,
    )
    print("upserted")

    hit = await find_similar("What is 17 times 24?", owner)
    print("paraphrase", None if not hit else (hit.mode, round(hit.similarity, 3), hit.entry.answer))
    assert hit and hit.mode == "full" and hit.entry.answer == "408"

    miss = await find_similar("What is the capital of France?", owner)
    print("unrelated", None if not miss else (miss.mode, round(miss.similarity, 3)))
    assert not miss or miss.mode != "full" or miss.entry.answer != "408"

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
