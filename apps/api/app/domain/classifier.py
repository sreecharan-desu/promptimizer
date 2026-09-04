from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Literal

Tier = Literal["economy", "standard", "frontier"]

CATEGORIES = (
    "factual_recall",
    "math",
    "code_generation",
    "code_debug",
    "system_design",
    "reasoning",
    "creative",
    "summarization",
    "translation",
    "analysis",
    "safety_sensitive",
)

HIGH_RISK = frozenset({"system_design", "safety_sensitive", "code_debug", "reasoning"})

_CODE_FENCE = re.compile(r"```")
_CODE_KW = re.compile(
    r"\b(def |class |function |import |fn |pub |async |await |SELECT |FROM |"
    r"goroutine|mutex|kubernetes|dockerfile|traceback|stack trace)\b",
    re.I,
)
_MATH = re.compile(
    r"(\$\$|\\frac|\\sum|prove that|expected value|O\([nN]\)|derivative|integral|\d+\s*[\*\^]\s*\d+)",
    re.I,
)
_DESIGN = re.compile(
    r"\b(design|architect|rate limiter|distributed|consistency|shard|failover|1 million QPS|scale to)\b",
    re.I,
)
_REASON = re.compile(
    r"\b(prove|why does|walk through|step by step|derive|contradiction|theorem|p-value|causal)\b",
    re.I,
)
_DEBUG = re.compile(
    r"\b(bug|race|panic|fails on|not working|regression|diagnose|deadlock)\b",
    re.I,
)
_SUMMARIZE = re.compile(r"\b(summarize|tl;dr|in two sentences|eli5|briefly explain)\b", re.I)
_TRANSLATE = re.compile(r"\b(translate|traduce|Übersetzung)\b", re.I)
_CREATIVE = re.compile(r"\b(write a (poem|story|song)|screenplay|haiku)\b", re.I)
_SAFETY = re.compile(
    r"\b(refund|legal|medical|hipaa|lawsuit|diagnosis|prescribe|attorney)\b",
    re.I,
)
_ANALYSIS = re.compile(r"\b(compare|trade-?off|versus|analyse|analyze|evaluate|should we)\b", re.I)
_MULTI_CONSTRAINT = re.compile(r"\b(must|include|constraints?|requirements?|at least)\b", re.I)


@dataclass(frozen=True)
class Classification:
    complexity: int
    category: str
    confidence: float
    recommended_tier: Tier
    quality_risk: Literal["low", "medium", "high"]
    rationale: str
    features: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _text_from_messages(messages: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for message in messages:
        content = message.get("content", "")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(str(block.get("text", "")))
    return "\n".join(parts).strip()


def classify_messages(messages: list[dict[str, Any]]) -> Classification:
    text = _text_from_messages(messages)
    return classify_text(text)


def classify_text(text: str) -> Classification:
    lowered = text.lower()
    chars = len(text)
    words = len(text.split())
    lines = text.count("\n") + 1

    hits = {
        "code_fence": bool(_CODE_FENCE.search(text)),
        "code_kw": bool(_CODE_KW.search(text)),
        "math": bool(_MATH.search(text)),
        "design": bool(_DESIGN.search(text)),
        "reason": bool(_REASON.search(text)),
        "debug": bool(_DEBUG.search(text)),
        "summarize": bool(_SUMMARIZE.search(text)),
        "translate": bool(_TRANSLATE.search(text)),
        "creative": bool(_CREATIVE.search(text)),
        "safety": bool(_SAFETY.search(text)),
        "analysis": bool(_ANALYSIS.search(text)),
        "constraints": len(_MULTI_CONSTRAINT.findall(text)),
        "chars": chars,
        "words": words,
        "lines": lines,
        "question_marks": text.count("?"),
    }

    category = _category(hits)
    complexity = _complexity(hits, category)
    risk = _risk(category, complexity)
    tier = _tier(complexity, risk)
    confidence = _confidence(hits, category)
    rationale = _rationale(category, complexity, tier, risk, hits)

    return Classification(
        complexity=complexity,
        category=category,
        confidence=round(confidence, 3),
        recommended_tier=tier,
        quality_risk=risk,
        rationale=rationale,
        features=hits,
    )


def _category(hits: dict[str, Any]) -> str:
    if hits["safety"]:
        return "safety_sensitive"
    if hits["design"]:
        return "system_design"
    if hits["debug"] and (hits["code_fence"] or hits["code_kw"]):
        return "code_debug"
    if hits["code_fence"] or hits["code_kw"]:
        return "code_generation"
    if hits["math"] and hits["reason"]:
        return "reasoning"
    if hits["math"]:
        return "math"
    if hits["reason"]:
        return "reasoning"
    if hits["translate"]:
        return "translation"
    if hits["summarize"]:
        return "summarization"
    if hits["creative"]:
        return "creative"
    if hits["analysis"]:
        return "analysis"
    if hits["words"] < 24 and hits["question_marks"] >= 1:
        return "factual_recall"
    return "analysis" if hits["words"] > 80 else "factual_recall"


def _complexity(hits: dict[str, Any], category: str) -> int:
    score = 1
    if hits["words"] > 40:
        score += 1
    if hits["words"] > 120:
        score += 1
    if hits["lines"] > 12 or hits["code_fence"]:
        score += 1
    if hits["constraints"] >= 2:
        score += 1
    if hits["design"] or hits["reason"]:
        score += 1
    if hits["debug"]:
        score += 1
    if category in {"system_design", "reasoning", "safety_sensitive"}:
        score = max(score + 1, 4)
    if category == "code_generation":
        score = max(score, 3)
    if category == "code_debug":
        score = max(score, 4)
    if category == "factual_recall" and hits["words"] < 20:
        score = min(score, 2)
    return max(1, min(5, score))


def _risk(category: str, complexity: int) -> Literal["low", "medium", "high"]:
    if category in HIGH_RISK or complexity >= 5:
        return "high"
    if complexity >= 3 or category in {"analysis", "code_generation"}:
        return "medium"
    return "low"


def _tier(complexity: int, risk: str) -> Tier:
    if complexity >= 4 or risk == "high":
        return "frontier"
    if complexity == 3:
        return "standard"
    return "economy"


def _confidence(hits: dict[str, Any], category: str) -> float:
    signals = sum(
        1
        for key in ("code_fence", "code_kw", "math", "design", "reason", "debug", "safety")
        if hits[key]
    )
    if category == "factual_recall" and hits["words"] < 16:
        return 0.9
    return min(0.95, 0.55 + 0.12 * signals)


def _rationale(category: str, complexity: int, tier: Tier, risk: str, hits: dict[str, Any]) -> str:
    return (
        f"{category.replace('_', ' ')} at complexity L{complexity} "
        f"({hits['words']} words). quality_risk={risk}. "
        f"Route to {tier} — cheapest tier that is adequate for this task."
    )


def complexity_from_override(level: int) -> Classification:
    level = max(1, min(5, int(level)))
    tier: Tier = "economy" if level <= 2 else "standard" if level == 3 else "frontier"
    risk = "low" if level <= 2 else "medium" if level == 3 else "high"
    return Classification(
        complexity=level,
        category="analysis",
        confidence=1.0,
        recommended_tier=tier,
        quality_risk=risk,
        rationale=f"Caller overrode complexity to L{level}.",
        features={"override": True, "level": level},
    )
