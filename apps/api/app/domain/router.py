from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.sessions import ProviderSession, touch_stats
from app.domain.cache import cache, completion_hash, prefix_hash
from app.domain.catalog import Fleet, ModelInfo
from app.domain.classifier import Classification, classify_messages, complexity_from_override
from app.domain.costing import compute_cost, estimate_tokens
from app.domain.quality import looks_degraded, score_answer
from app.providers import openai_compat
from app.providers.mock import mock_complete


TIER_ORDER = ("economy", "standard", "frontier")


class RoutingError(Exception):
    pass


def pick_model(fleet: Fleet, classification: Classification) -> ModelInfo:
    start = classification.recommended_tier
    for tier in TIER_ORDER[TIER_ORDER.index(start) :]:
        chosen = fleet.cheapest(tier)  # type: ignore[arg-type]
        if chosen:
            return chosen
    any_model = fleet.cheapest()
    if not any_model:
        raise RoutingError("No selected models available to route to.")
    return any_model


def next_tier_model(fleet: Fleet, current: ModelInfo) -> ModelInfo | None:
    idx = TIER_ORDER.index(current.tier) if current.tier in TIER_ORDER else 0
    for tier in TIER_ORDER[idx + 1 :]:
        candidate = fleet.cheapest(tier)  # type: ignore[arg-type]
        if candidate and candidate.id != current.id:
            return candidate
    return None


async def route_chat(
    session: ProviderSession,
    *,
    messages: list[dict[str, Any]],
    stream: bool = False,
    level_override: int | None = None,
    model_hint: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if stream:
        raise RoutingError("Streaming is not enabled in the simulator API yet.")

    extra = extra or {}
    classification = (
        complexity_from_override(level_override) if level_override else classify_messages(messages)
    )
    fleet = session.fleet_obj()
    routed = fleet.by_id(model_hint) if model_hint and model_hint not in {"auto", "promptimizer"} else None
    if routed is None:
        routed = pick_model(fleet, classification)
    baseline = fleet.frontier()
    if baseline is None:
        raise RoutingError("No baseline / frontier model configured.")

    digest, prefix_tokens, _prefix = prefix_hash(messages)
    prefix_hit = cache.remember_prefix(digest) if prefix_tokens else False
    exact_key = completion_hash(messages, routed.id)
    cached_completion = cache.get(f"exact:{exact_key}")

    escalated = False
    if cached_completion:
        provider_payload = cached_completion
        cache_hits = 1
    else:
        provider_payload = await _complete(session, routed.id, messages, classification, extra)
        cache.set(f"exact:{exact_key}", provider_payload)
        cache_hits = 0

        if get_settings().quality_guard:
            text = _content(provider_payload)
            if looks_degraded(text, classification.complexity):
                upgrade = next_tier_model(fleet, routed)
                if upgrade:
                    escalated = True
                    routed = upgrade
                    provider_payload = await _complete(
                        session, routed.id, messages, classification, extra
                    )
                    cache.set(f"exact:{completion_hash(messages, routed.id)}", provider_payload)

    usage = provider_payload.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or estimate_tokens(str(messages)))
    completion_tokens = int(usage.get("completion_tokens") or estimate_tokens(_content(provider_payload)))
    cached_tokens = prefix_tokens if prefix_hit else 0

    cost = compute_cost(
        routed=routed,
        baseline=baseline,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cached_tokens=cached_tokens,
    )
    quality = score_answer(
        _content(provider_payload),
        difficulty=classification.complexity,
        threshold=get_settings().quality_escalate_threshold,
    )

    touch_stats(
        session,
        requests=1,
        actual_usd=cost.actual_usd,
        baseline_usd=cost.baseline_usd,
        saved_usd=cost.saved_usd,
        cache_hits=cache_hits + (1 if prefix_hit else 0),
        escalations=1 if escalated else 0,
        quality_fails=1 if quality.degraded else 0,
    )

    result = dict(provider_payload)
    result["model"] = routed.id
    result["usage"] = {
        **usage,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "cost": cost.as_dict(),
    }
    result["promptimizer"] = {
        "session_id": session.id,
        "complexity": classification.complexity,
        "category": classification.category,
        "confidence": classification.confidence,
        "tier": routed.tier,
        "model": routed.id,
        "baseline_model": baseline.id,
        "cache_hit": bool(cached_completion) or prefix_hit,
        "prefix_cache_hit": prefix_hit,
        "exact_cache_hit": bool(cached_completion),
        "escalated": escalated,
        "quality_gate": "fail" if quality.degraded else "pass",
        "quality": quality.as_dict(),
        "rationale": classification.rationale,
        "features": classification.features,
    }
    return result


async def _complete(
    session: ProviderSession,
    model: str,
    messages: list[dict[str, Any]],
    classification: Classification,
    extra: dict[str, Any],
) -> dict[str, Any]:
    if session.mode == "mock":
        return mock_complete(model=model, messages=messages, classification=classification)
    body = {"model": model, "messages": messages, **extra}
    body.pop("level_override", None)
    return await openai_compat.chat_completions(
        base_url=session.base_url,
        api_key=session.api_key(),
        body=body,
    )


def _content(payload: dict[str, Any]) -> str:
    try:
        return str(payload["choices"][0]["message"]["content"] or "")
    except Exception:
        return ""
