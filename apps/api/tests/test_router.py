import pytest

from app.core.sessions import create_mock_session
from app.domain.router import route_chat


@pytest.mark.asyncio
async def test_easy_routes_to_nano():
    session = create_mock_session()
    result = await route_chat(
        session,
        messages=[{"role": "user", "content": "What is the capital of France?"}],
    )
    assert result["promptimizer"]["tier"] == "economy"
    assert "Paris" in result["choices"][0]["message"]["content"]
    assert result["usage"]["cost"]["saved_pct"] > 0


@pytest.mark.asyncio
async def test_hard_routes_to_frontier_or_escalates():
    session = create_mock_session()
    result = await route_chat(
        session,
        messages=[
            {
                "role": "user",
                "content": (
                    "Design a rate limiter that supports 1 million QPS across 50 edge regions, "
                    "per-API-key quotas, and burst tokens. Discuss consistency and failure modes."
                ),
            }
        ],
    )
    meta = result["promptimizer"]
    assert meta["tier"] == "frontier"
    text = result["choices"][0]["message"]["content"]
    assert "token bucket" in text.lower() or "Redis" in text
    assert meta["quality_gate"] == "pass"


@pytest.mark.asyncio
async def test_prompt_cache_hits_on_repeated_system():
    session = create_mock_session()
    system = {"role": "system", "content": "You are a careful support agent. " + ("policy " * 80)}
    first = await route_chat(
        session,
        messages=[system, {"role": "user", "content": "What is the capital of France?"}],
    )
    second = await route_chat(
        session,
        messages=[system, {"role": "user", "content": "What does HTTP stand for?"}],
    )
    assert first["promptimizer"]["prefix_cache_hit"] is False
    assert second["promptimizer"]["prefix_cache_hit"] is True
