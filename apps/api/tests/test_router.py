from app.domain.catalog import ModelInfo, fleet_from_provider_models, is_uuid_model_id
from app.domain.classifier import classify_messages
from app.domain.costing import compute_cost
from app.domain.router import pick_model


def _fleet():
    return fleet_from_provider_models(
        [
            {"id": "promptimizer-nano", "owned_by": "promptimizer"},
            {"id": "promptimizer-flash", "owned_by": "promptimizer"},
            {"id": "promptimizer-frontier", "owned_by": "promptimizer"},
        ]
    )


def test_easy_routes_to_economy():
    fleet = _fleet()
    classification = classify_messages(
        [{"role": "user", "content": "What is the capital of France?"}]
    )
    chosen = pick_model(fleet, classification)
    assert chosen.tier == "economy"
    assert chosen.id == "promptimizer-nano"


def test_hard_routes_to_frontier():
    fleet = _fleet()
    classification = classify_messages(
        [
            {
                "role": "user",
                "content": (
                    "Design a rate limiter that supports 1 million QPS across 50 edge regions, "
                    "per-API-key quotas, and burst tokens. Discuss consistency and failure modes."
                ),
            }
        ]
    )
    chosen = pick_model(fleet, classification)
    assert chosen.tier == "frontier"
    assert chosen.id == "promptimizer-frontier"


def test_negative_savings_allowed():
    """When routed model is more expensive than baseline, saved_usd may be negative."""
    cheap_baseline = ModelInfo(
        id="baseline-cheap",
        owned_by="t",
        input_per_1m=0.1,
        output_per_1m=0.2,
        tier="economy",
    )
    expensive = ModelInfo(
        id="routed-expensive",
        owned_by="t",
        input_per_1m=10.0,
        output_per_1m=30.0,
        tier="frontier",
    )
    cost = compute_cost(
        routed=expensive,
        baseline=cheap_baseline,
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
    )
    assert cost.saved_usd < 0
    assert cost.routing_saved_usd < 0


def test_full_replay_zero_actual():
    routed = ModelInfo(
        id="nano",
        owned_by="t",
        input_per_1m=0.1,
        output_per_1m=0.2,
        tier="economy",
    )
    baseline = ModelInfo(
        id="frontier",
        owned_by="t",
        input_per_1m=5.0,
        output_per_1m=15.0,
        tier="frontier",
    )
    cost = compute_cost(
        routed=routed,
        baseline=baseline,
        prompt_tokens=1000,
        completion_tokens=500,
        full_replay=True,
    )
    assert cost.actual_usd == 0.0
    assert cost.cache_replay is True
    assert cost.saved_usd == cost.baseline_usd


def test_uuid_model_ids_filtered():
    assert is_uuid_model_id("a1b2c3d4-e5f6-4789-abcd-ef0123456789")
    fleet = fleet_from_provider_models(
        [
            {"id": "a1b2c3d4-e5f6-4789-abcd-ef0123456789", "owned_by": "baseten"},
            {"id": "promptimizer-nano", "owned_by": "promptimizer"},
        ]
    )
    ids = {m.id for m in fleet.models}
    assert "a1b2c3d4-e5f6-4789-abcd-ef0123456789" not in ids
    assert "promptimizer-nano" in ids
