from app.domain.catalog import fleet_from_provider_models, infer_tier


def test_infer_mini_is_economy():
    tier, _ = infer_tier("gpt-4o-mini")
    assert tier == "economy"


def test_infer_opus_is_frontier():
    tier, _ = infer_tier("claude-opus-4")
    assert tier == "frontier"


def test_fleet_skips_embeddings():
    fleet = fleet_from_provider_models(
        [
            {"id": "gpt-4o", "owned_by": "openai"},
            {"id": "text-embedding-3-large", "owned_by": "openai"},
            {"id": "gpt-4o-mini", "owned_by": "openai"},
        ]
    )
    ids = [m.id for m in fleet.models]
    assert "gpt-4o" in ids
    assert "gpt-4o-mini" in ids
    assert "text-embedding-3-large" not in ids
    assert fleet.baseline_model == "gpt-4o"
