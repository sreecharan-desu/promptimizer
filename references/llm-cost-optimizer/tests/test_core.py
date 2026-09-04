from decimal import Decimal
import pytest

from app.core.cost import CostEstimator
from app.core.providers import ProviderRegistry
from app.core.routing import ModelCapabilityChecker
from app.core.schemas import (
    ModelPricing, ModelProfile, ProviderDefinition,
    RequestRequirements, TokenPrice,
)


def test_provider_registry_lookup():
    registry = ProviderRegistry({
        "openai": ProviderDefinition(
            provider_id="openai",
            display_name="OpenAI",
            base_url="https://api.openai.com/v1",
        )
    })
    assert registry.exists("openai")
    assert registry.get("openai").display_name == "OpenAI"
    with pytest.raises(ValueError):
        registry.get("unknown")


def test_capability_checker():
    model = ModelProfile(
        provider_id="openai",
        model_id="demo",
        display_name="Demo",
        context_length=100_000,
        max_completion_tokens=10_000,
        supported_features=("tools", "reasoning", "structured_outputs"),
        input_modalities=("text", "image"),
    )
    requirements = RequestRequirements(
        requires_tools=True,
        requires_reasoning=True,
        requires_structured_output=True,
        requires_vision=True,
        minimum_context_tokens=50_000,
        minimum_output_tokens=8_000,
    )
    result = ModelCapabilityChecker.check(model, requirements)
    assert result.eligible is True
    assert result.reasons == ()


def test_cost_estimator():
    model = ModelProfile(
        provider_id="openai",
        model_id="demo",
        display_name="Demo",
        pricing=ModelPricing(
            prompt=TokenPrice(usd_per_token=Decimal("0.0000001")),
            completion=TokenPrice(usd_per_token=Decimal("0.0000005")),
        ),
    )
    estimate = CostEstimator.estimate(model, 2000, 500)
    assert estimate.total_cost_usd == Decimal("0.00045")
