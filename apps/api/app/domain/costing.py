from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domain.catalog import ModelInfo, lookup_pricing


@dataclass
class CostBreakdown:
    actual_usd: float
    baseline_usd: float
    saved_usd: float
    saved_pct: float
    routing_saved_usd: float
    cache_discount_usd: float
    prompt_tokens: int
    completion_tokens: int
    cached_tokens: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "actual_usd": round(self.actual_usd, 8),
            "baseline_usd": round(self.baseline_usd, 8),
            "saved_usd": round(self.saved_usd, 8),
            "saved_pct": round(self.saved_pct, 2),
            "routing_saved_usd": round(self.routing_saved_usd, 8),
            "cache_discount_usd": round(self.cache_discount_usd, 8),
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "cached_tokens": self.cached_tokens,
        }


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, round(len(text) / 4))


def price_pair(model: ModelInfo | None, model_id: str | None = None) -> tuple[float, float]:
    if model and model.input_per_1m is not None and model.output_per_1m is not None:
        return model.input_per_1m, model.output_per_1m
    priced = lookup_pricing(model.id if model else (model_id or ""))
    if priced:
        return float(priced["input"]), float(priced["output"])
    return 1.0, 3.0


def compute_cost(
    *,
    routed: ModelInfo,
    baseline: ModelInfo,
    prompt_tokens: int,
    completion_tokens: int,
    cached_tokens: int = 0,
    cache_discount: float = 0.5,
) -> CostBreakdown:
    rin, rout = price_pair(routed)
    bin_, bout = price_pair(baseline)
    billable_prompt = max(0, prompt_tokens - cached_tokens)
    cached = max(0, min(cached_tokens, prompt_tokens))
    actual = (
        (billable_prompt / 1_000_000) * rin
        + (cached / 1_000_000) * rin * cache_discount
        + (completion_tokens / 1_000_000) * rout
    )
    baseline_cost = (prompt_tokens / 1_000_000) * bin_ + (completion_tokens / 1_000_000) * bout
    full_routed = (prompt_tokens / 1_000_000) * rin + (completion_tokens / 1_000_000) * rout
    cache_discount_usd = max(0.0, full_routed - actual)
    routing_saved = max(0.0, baseline_cost - full_routed)
    saved = max(0.0, baseline_cost - actual)
    pct = (saved / baseline_cost * 100) if baseline_cost > 0 else 0.0
    return CostBreakdown(
        actual_usd=actual,
        baseline_usd=baseline_cost,
        saved_usd=saved,
        saved_pct=pct,
        routing_saved_usd=routing_saved,
        cache_discount_usd=cache_discount_usd,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cached_tokens=cached,
    )
