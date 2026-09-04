from app.domain.classifier import classify_text


def test_easy_factual():
    result = classify_text("What is the capital of France?")
    assert result.complexity <= 2
    assert result.recommended_tier == "economy"
    assert result.category == "factual_recall"
    assert result.p_small_quality >= 0.9


def test_hard_system_design_goes_frontier():
    result = classify_text(
        "Design a rate limiter that supports 1 million QPS across 50 edge regions, "
        "per-API-key quotas, and burst tokens. Discuss consistency and failure modes."
    )
    assert result.complexity >= 4
    assert result.recommended_tier == "frontier"
    assert result.category == "system_design"
    assert result.quality_risk == "high"
    assert result.p_small_quality < 0.72


def test_code_generation_is_not_economy_by_default():
    result = classify_text(
        "Write a Python function merge_sorted(a, b) that merges two sorted lists "
        "in O(n) time. Include a docstring and tests."
    )
    assert result.category == "code_generation"
    assert result.recommended_tier in {"standard", "frontier"}
