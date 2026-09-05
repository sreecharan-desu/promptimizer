from app.domain.catalog import fleet_from_provider_models
from app.domain.classifier import classify_messages
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
