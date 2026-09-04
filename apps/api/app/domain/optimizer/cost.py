from __future__ import annotations
from decimal import Decimal
from app.domain.optimizer.schemas import CostEstimate, ModelProfile


class CostEstimator:
    @staticmethod
    def estimate(
        model: ModelProfile,
        input_tokens: int,
        output_tokens: int,
        cache_read_tokens: int = 0,
    ) -> CostEstimate:
        if model.pricing is None:
            raise ValueError(f"No pricing information for '{model.model_id}'")
        if model.pricing.prompt is None:
            raise ValueError(f"No input pricing for '{model.model_id}'")
        if model.pricing.completion is None:
            raise ValueError(f"No output pricing for '{model.model_id}'")

        input_billable = max(0, input_tokens - cache_read_tokens)
        input_cost = Decimal(input_billable) * model.pricing.prompt.usd_per_token
        output_cost = Decimal(output_tokens) * model.pricing.completion.usd_per_token

        cache_cost = Decimal("0")
        if cache_read_tokens and model.pricing.input_cache_read:
            cache_cost = (
                Decimal(cache_read_tokens)
                * model.pricing.input_cache_read.usd_per_token
            )

        total = input_cost + output_cost + cache_cost
        return CostEstimate(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_cost_usd=input_cost,
            output_cost_usd=output_cost,
            cache_cost_usd=cache_cost,
            total_cost_usd=total,
        )
