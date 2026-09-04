from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import require_session
from app.core.sessions import (
    ProviderSession,
    create_byok_session,
    create_mock_session,
    public_session,
    sessions,
    update_session_fleet,
)
from app.domain.cache import cache
from app.domain.catalog import fleet_from_provider_models
from app.domain.classifier import classify_messages, classify_text
from app.domain.providers import public_catalog, resolve_base_url
from app.domain.quality import score_answer
from app.domain.router import RoutingError, route_chat
from app.providers.mock import mock_models
from app.providers.openai_compat import ProviderError, list_models

router = APIRouter()
_BENCH = Path(__file__).resolve().parent.parent / "data" / "benchmark.json"


class ConnectBody(BaseModel):
    mode: str = Field(description="mock | byok")
    label: str | None = None
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None


class FleetPatch(BaseModel):
    overrides: dict[str, str] = Field(default_factory=dict)
    selected: dict[str, bool] = Field(default_factory=dict)
    baseline_model: str | None = None


class ChatBody(BaseModel):
    messages: list[dict[str, Any]]
    model: str | None = "auto"
    stream: bool = False
    level_override: int | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class ClassifyBody(BaseModel):
    messages: list[dict[str, Any]] | None = None
    prompt: str | None = None


class BenchmarkBody(BaseModel):
    compare_always_frontier: bool = True


@router.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "promptimizer", "cache": cache.stats()}


@router.get("/v1/providers")
async def providers() -> dict[str, Any]:
    return {"object": "list", "data": public_catalog()}


@router.post("/v1/providers/connect")
async def connect(body: ConnectBody) -> dict[str, Any]:
    if body.mode == "mock":
        session = create_mock_session(body.label or "Promptimizer simulator")
        return public_session(session)
    base_url, provider = resolve_base_url(provider=body.provider, base_url=body.base_url)
    if not base_url:
        raise HTTPException(
            status_code=400,
            detail="Unknown provider. Pass base_url for a custom OpenAI-compatible /v1.",
        )
    api_key = (body.api_key or "").strip()
    if not api_key and provider and provider["id"] == "ollama":
        api_key = "ollama"
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required.")
    try:
        raw = await list_models(base_url, api_key)
    except ProviderError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=f"Provider rejected the key: {exc.detail}",
        ) from None
    if not raw:
        raw = [{"id": "default", "owned_by": "provider"}]
    fleet = fleet_from_provider_models(raw)
    if not fleet.models:
        raise HTTPException(
            status_code=400,
            detail="No chat models found on this OpenAI-compatible endpoint.",
        )
    session = create_byok_session(
        label=body.label or (provider["label"] if provider else "BYOK"),
        base_url=base_url,
        api_key=api_key,
        fleet=fleet,
    )
    return public_session(session)


@router.get("/v1/session")
async def get_session(session: ProviderSession = Depends(require_session)) -> dict[str, Any]:
    return public_session(session)


@router.delete("/v1/session")
async def drop_session(session: ProviderSession = Depends(require_session)) -> dict[str, bool]:
    sessions.delete(session.id)
    return {"ok": True}


@router.get("/v1/models")
async def models(session: ProviderSession = Depends(require_session)) -> dict[str, Any]:
    data = session.fleet.get("models", [])
    return {"object": "list", "data": data, "baseline_model": session.baseline_model}


@router.patch("/v1/models")
async def patch_models(
    body: FleetPatch,
    session: ProviderSession = Depends(require_session),
) -> dict[str, Any]:
    session = update_session_fleet(
        session,
        overrides=body.overrides,
        baseline_model=body.baseline_model,
        selected=body.selected,
    )
    return public_session(session)


@router.post("/v1/classify")
async def classify(body: ClassifyBody) -> dict[str, Any]:
    if body.messages:
        result = classify_messages(body.messages)
    elif body.prompt:
        result = classify_text(body.prompt)
    else:
        raise HTTPException(status_code=400, detail="Provide messages or prompt.")
    return result.as_dict()


@router.post("/v1/chat/completions")
async def chat_completions(
    body: ChatBody,
    session: ProviderSession = Depends(require_session),
) -> dict[str, Any]:
    extra: dict[str, Any] = {}
    if body.temperature is not None:
        extra["temperature"] = body.temperature
    if body.max_tokens is not None:
        extra["max_tokens"] = body.max_tokens
    try:
        return await route_chat(
            session,
            messages=body.messages,
            stream=body.stream,
            level_override=body.level_override,
            model_hint=body.model,
            extra=extra,
        )
    except RoutingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except ProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.get("/v1/benchmark")
async def benchmark_spec() -> dict[str, Any]:
    return json.loads(_BENCH.read_text())


@router.post("/v1/benchmark/run")
async def run_benchmark(
    body: BenchmarkBody,
    session: ProviderSession = Depends(require_session),
) -> dict[str, Any]:
    spec = json.loads(_BENCH.read_text())
    rows: list[dict[str, Any]] = []
    totals = {
        "actual_usd": 0.0,
        "baseline_usd": 0.0,
        "saved_usd": 0.0,
        "routed_quality": 0.0,
        "frontier_quality": 0.0,
        "escalations": 0,
        "cache_hits": 0,
        "quality_fails": 0,
        "worst_routed": 1.0,
        "worst_frontier": 1.0,
    }

    for task in spec["tasks"]:
        messages = [{"role": "user", "content": task["prompt"]}]
        try:
            routed = await route_chat(session, messages=messages)
        except Exception as exc:
            rows.append({"id": task["id"], "error": str(exc)})
            continue

        answer = routed["choices"][0]["message"]["content"]
        q_routed = score_answer(
            answer,
            gold=task.get("gold", ""),
            must_include=task.get("must_include", []),
            difficulty=task.get("difficulty", 3),
        )
        cost = routed["usage"]["cost"]
        meta = routed["promptimizer"]

        frontier_answer = answer
        q_frontier = q_routed
        if body.compare_always_frontier and session.baseline_model:
            try:
                frontier = await route_chat(
                    session,
                    messages=messages,
                    model_hint=session.baseline_model,
                    extra={},
                )
                frontier_answer = frontier["choices"][0]["message"]["content"]
                q_frontier = score_answer(
                    frontier_answer,
                    gold=task.get("gold", ""),
                    must_include=task.get("must_include", []),
                    difficulty=task.get("difficulty", 3),
                )
            except Exception:
                pass

        totals["actual_usd"] += cost["actual_usd"]
        totals["baseline_usd"] += cost["baseline_usd"]
        totals["saved_usd"] += cost["saved_usd"]
        totals["routed_quality"] += q_routed.score
        totals["frontier_quality"] += q_frontier.score
        totals["escalations"] += 1 if meta.get("escalated") else 0
        totals["cache_hits"] += 1 if meta.get("cache_hit") else 0
        totals["quality_fails"] += 1 if q_routed.degraded else 0
        totals["worst_routed"] = min(totals["worst_routed"], q_routed.score)
        totals["worst_frontier"] = min(totals["worst_frontier"], q_frontier.score)

        rows.append(
            {
                "id": task["id"],
                "difficulty": task["difficulty"],
                "category": task["category"],
                "prompt": task["prompt"],
                "model": meta["model"],
                "tier": meta["tier"],
                "complexity": meta["complexity"],
                "escalated": meta.get("escalated"),
                "cost": cost,
                "quality_routed": q_routed.as_dict(),
                "quality_frontier": q_frontier.as_dict(),
                "quality_delta": round(q_routed.score - q_frontier.score, 3),
                "answer": answer,
                "frontier_answer": frontier_answer,
            }
        )

    n = max(1, len([r for r in rows if "error" not in r]))
    if totals["baseline_usd"]:
        saved_pct = totals["saved_usd"] / totals["baseline_usd"] * 100
    else:
        saved_pct = 0
    return {
        "name": spec["name"],
        "tasks": len(spec["tasks"]),
        "summary": {
            "actual_usd": round(totals["actual_usd"], 6),
            "baseline_usd": round(totals["baseline_usd"], 6),
            "saved_usd": round(totals["saved_usd"], 6),
            "saved_pct": round(saved_pct, 2),
            "avg_quality_routed": round(totals["routed_quality"] / n, 3),
            "avg_quality_frontier": round(totals["frontier_quality"] / n, 3),
            "worst_quality_routed": round(totals["worst_routed"], 3),
            "quality_delta": round((totals["routed_quality"] - totals["frontier_quality"]) / n, 3),
            "cache_hit_rate": round(totals["cache_hits"] / n, 3),
            "escalation_rate": round(totals["escalations"] / n, 3),
            "escalations": totals["escalations"],
            "cache_hits": totals["cache_hits"],
            "quality_fails": totals["quality_fails"],
        },
        "rows": rows,
        "session": public_session(session),
        "cache": cache.stats(),
    }


@router.get("/v1/analytics")
async def analytics(session: ProviderSession = Depends(require_session)) -> dict[str, Any]:
    stats = session.stats
    baseline = stats.get("baseline_usd") or 0
    return {
        "session": public_session(session),
        "cache": cache.stats(),
        "saved_pct": round((stats.get("saved_usd") or 0) / baseline * 100, 2) if baseline else 0,
        "mock_models": mock_models() if session.mode == "mock" else None,
    }
