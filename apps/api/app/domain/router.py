from __future__ import annotations

import time
from collections.abc import Mapping
from decimal import Decimal
from typing import Any

from app.core.config import get_settings
from app.core.sessions import ProviderSession, touch_stats
from app.domain.cache import cache, completion_hash, prefix_hash
from app.domain.catalog import Fleet, ModelInfo
from app.domain.classifier import Classification, classify_messages, complexity_from_override
from app.domain.costing import compute_cost, estimate_tokens
from app.domain.optimizer.requirements import extract_requirements
from app.domain.optimizer.routing import QualityAwareRouter
from app.domain.optimizer.schemas import (
    ModelPricing,
    ModelProfile,
    ModelQualityProfile,
    TokenPrice,
)
from app.domain.quality import looks_degraded, score_answer
from app.domain.semantic_cache import (
    build_hybrid_messages,
    find_similar,
    remember_semantic,
)
from app.providers import openai_compat

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


def _to_profile(model: ModelInfo) -> ModelProfile:
    pricing = None
    if model.input_per_1m is not None and model.output_per_1m is not None:
        pricing = ModelPricing(
            prompt=TokenPrice(usd_per_token=Decimal(str(model.input_per_1m / 1_000_000))),
            completion=TokenPrice(usd_per_token=Decimal(str(model.output_per_1m / 1_000_000))),
        )
    # Permissive feature defaults for BYOK fleets without capability metadata.
    return ModelProfile(
        provider_id=model.owned_by or "provider",
        model_id=model.id,
        display_name=model.id,
        context_length=128_000,
        max_completion_tokens=16_384,
        pricing=pricing,
        supported_features=("tools", "reasoning", "structured_outputs"),
        input_modalities=("text", "image"),
        output_modalities=("text",),
    )


def _normalize_quality_profiles(
    raw: Mapping[str, Any] | None,
) -> dict[str, ModelQualityProfile]:
    if not raw:
        return {}
    out: dict[str, ModelQualityProfile] = {}
    for key, value in raw.items():
        if isinstance(value, ModelQualityProfile):
            out[value.model_id or key] = value
            continue
        if isinstance(value, dict):
            mid = str(value.get("model_id") or key)
            overall = float(value.get("overall_quality", 0.8))
            out[mid] = ModelQualityProfile(
                model_id=mid,
                overall_quality=overall,
                reasoning_quality=float(value.get("reasoning_quality", overall)),
                coding_quality=float(value.get("coding_quality", overall)),
                extraction_quality=float(value.get("extraction_quality", overall)),
                factual_quality=float(value.get("factual_quality", overall)),
            )
    return out


def _attempt_cost(
    routed: ModelInfo,
    baseline: ModelInfo,
    payload: dict[str, Any],
    messages: list[dict[str, Any]],
    cached_tokens: int,
) -> float:
    usage = payload.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or estimate_tokens(str(messages)))
    completion_tokens = int(
        usage.get("completion_tokens") or estimate_tokens(_content(payload))
    )
    return compute_cost(
        routed=routed,
        baseline=baseline,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cached_tokens=cached_tokens,
    ).actual_usd


async def route_chat(
    session: ProviderSession,
    *,
    messages: list[dict[str, Any]],
    stream: bool = False,
    level_override: int | None = None,
    model_hint: str | None = None,
    extra: dict[str, Any] | None = None,
    quality_profiles: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # Streaming is handled at the HTTP layer (buffer-then-SSE). Core routing is sync.
    del stream

    extra = extra or {}
    started = time.perf_counter()
    classification = (
        complexity_from_override(level_override) if level_override else classify_messages(messages)
    )
    requirements = extract_requirements(messages, extra)
    fleet = session.fleet_obj()
    profiles = _normalize_quality_profiles(quality_profiles)

    routed: ModelInfo | None = None
    routing_policy = "bootstrap_heuristic"
    if model_hint and model_hint not in {"auto", "promptimizer"}:
        routed = fleet.by_id(model_hint)
    elif profiles:
        try:
            qar = QualityAwareRouter(profiles, minimum_quality=0.72)
            profiles_models = [_to_profile(m) for m in fleet.models if m.selected]
            task = requirements.task_type.value if requirements.task_type else None
            # ModelCapabilityChecker runs inside QualityAwareRouter.candidates
            chosen = qar.choose(profiles_models, requirements, task_type=task)
            routed = fleet.by_id(chosen.model.model_id)
            if routed:
                routing_policy = "quality_profile"
        except ValueError:
            routed = None

    if routed is None:
        routed = pick_model(fleet, classification)
        routing_policy = "bootstrap_heuristic"

    initial_model = routed
    baseline = fleet.frontier()
    if baseline is None:
        raise RoutingError("No baseline / frontier model configured.")

    digest, prefix_tokens, _prefix = prefix_hash(messages)
    owner = session.id
    prefix_hit = cache.remember_prefix(digest, owner) if prefix_tokens else False
    exact_key = completion_hash(messages, routed.id)
    cached_completion = cache.get(f"exact:{exact_key}", owner)

    user_prompt = ""
    for message in reversed(messages):
        if message.get("role") == "user":
            content = message.get("content")
            user_prompt = content if isinstance(content, str) else str(content or "")
            break
    if not user_prompt:
        user_prompt = "\n".join(str(m.get("content") or "") for m in messages)

    semantic = None
    semantic_mode = "off"
    outbound_messages = messages
    escalated = False
    wasted_usd = 0.0
    from_cache_replay = False

    if cached_completion:
        provider_payload = cached_completion
        cache_hits = 1
        from_cache_replay = True
    else:
        semantic = await find_similar(user_prompt, owner)
        semantic_mode = semantic.mode if semantic else "miss"
        if semantic and semantic.mode == "full":
            provider_payload = {
                "id": f"chatcmpl-semantic-{int(time.time() * 1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": semantic.entry.model or routed.id,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": semantic.entry.answer},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": estimate_tokens(user_prompt),
                    "completion_tokens": estimate_tokens(semantic.entry.answer),
                    "total_tokens": estimate_tokens(user_prompt)
                    + estimate_tokens(semantic.entry.answer),
                },
            }
            cache_hits = 1
            from_cache_replay = True
        else:
            if semantic and semantic.mode == "hybrid":
                outbound_messages = build_hybrid_messages(messages, semantic)
            provider_payload = await _complete(
                session, routed.id, outbound_messages, classification, extra
            )
            cache.set(f"exact:{exact_key}", provider_payload, owner)
            cache_hits = 0

            if get_settings().quality_guard:
                text = _content(provider_payload)
                quality_probe = score_answer(
                    text,
                    difficulty=classification.complexity,
                    threshold=get_settings().quality_escalate_threshold,
                )
                should_escalate = looks_degraded(
                    text, classification.complexity
                ) or quality_probe.degraded
                if should_escalate:
                    first_cost = _attempt_cost(
                        routed, baseline, provider_payload, outbound_messages, 0
                    )
                    # Walk escalate tiers until frontier or quality passes.
                    current = routed
                    while True:
                        upgrade = next_tier_model(fleet, current)
                        if not upgrade:
                            break
                        escalated = True
                        current = upgrade
                        routed = upgrade
                        provider_payload = await _complete(
                            session, routed.id, outbound_messages, classification, extra
                        )
                        cache.set(
                            f"exact:{completion_hash(messages, routed.id)}",
                            provider_payload,
                            owner,
                        )
                        retry_text = _content(provider_payload)
                        retry_quality = score_answer(
                            retry_text,
                            difficulty=classification.complexity,
                            threshold=get_settings().quality_escalate_threshold,
                        )
                        if not (
                            looks_degraded(retry_text, classification.complexity)
                            or retry_quality.degraded
                        ):
                            break
                    if escalated:
                        wasted_usd = first_cost

    usage = provider_payload.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or estimate_tokens(str(messages)))
    completion_tokens = int(
        usage.get("completion_tokens") or estimate_tokens(_content(provider_payload))
    )
    cached_tokens = prefix_tokens if prefix_hit else 0
    full_replay = from_cache_replay and not escalated

    cost = compute_cost(
        routed=routed,
        baseline=baseline,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cached_tokens=cached_tokens,
        full_replay=full_replay,
        wasted_usd=0.0 if full_replay else wasted_usd,
    )
    quality = score_answer(
        _content(provider_payload),
        difficulty=classification.complexity,
        threshold=get_settings().quality_escalate_threshold,
    )

    if not full_replay and not quality.degraded:
        answer_text = _content(provider_payload)
        if answer_text.strip():
            await remember_semantic(
                prompt=user_prompt,
                answer=answer_text,
                model=routed.id,
                tier=routed.tier,
                quality=float(getattr(quality, "score", 0.0) or 0.0),
                owner=owner,
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
        escalation_waste=cost.wasted_usd,
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
        "p_small_quality": classification.p_small_quality,
        "uncertainty": classification.uncertainty,
        "tier": routed.tier,
        "model": routed.id,
        "initial_model": initial_model.id,
        "final_model": routed.id,
        "baseline_model": baseline.id,
        "routing_policy": routing_policy,
        "requirements": requirements.model_dump(),
        "cache_hit": from_cache_replay or prefix_hit,
        "cache_replay": cost.cache_replay,
        "prefix_cache_hit": prefix_hit,
        "exact_cache_hit": bool(cached_completion),
        "semantic_cache_hit": semantic_mode in {"full", "hybrid"},
        "semantic_cache_mode": semantic_mode,
        "semantic_similarity": None if not semantic else round(semantic.similarity, 4),
        "escalated": escalated,
        "wasted_usd": cost.wasted_usd,
        "quality_gate": "fail" if quality.degraded else "pass",
        "quality": quality.as_dict(),
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
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
    del classification  # provider path does not use classification
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
