from app.domain.quality import score_answer


def test_gold_match_scores_high():
    score = score_answer(
        "Paris is the capital of France.",
        gold="Paris is the capital of France.",
        must_include=["Paris"],
        difficulty=1,
    )
    assert score.score >= 0.9
    assert not score.degraded


def test_thin_hard_answer_is_degraded():
    score = score_answer(
        "Use Redis.",
        gold="Use a distributed token bucket with Redis and eventual consistency.",
        must_include=["token bucket", "Redis", "eventual"],
        difficulty=5,
    )
    assert score.degraded
    assert score.score < 0.62
