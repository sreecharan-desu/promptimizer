from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

_TOKEN = re.compile(r"[a-z0-9]+", re.I)


@dataclass
class QualityScore:
    score: float
    lexical_f1: float
    coverage: float
    structure: float
    degraded: bool
    notes: list[str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "score": round(self.score, 3),
            "lexical_f1": round(self.lexical_f1, 3),
            "coverage": round(self.coverage, 3),
            "structure": round(self.structure, 3),
            "degraded": self.degraded,
            "notes": self.notes,
        }


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN.findall(text) if len(t) > 1}


def lexical_f1(pred: str, gold: str) -> float:
    a, b = _tokens(pred), _tokens(gold)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    overlap = len(a & b)
    precision = overlap / len(a)
    recall = overlap / len(b)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def coverage(pred: str, must_include: list[str]) -> float:
    if not must_include:
        return 1.0
    blob = pred.lower()
    hits = sum(1 for needle in must_include if needle.lower() in blob)
    return hits / len(must_include)


def structure_score(pred: str, difficulty: int) -> float:
    if not pred or len(pred.strip()) < 8:
        return 0.0
    score = 0.4
    if len(pred) > 80:
        score += 0.2
    if difficulty >= 4:
        if re.search(r"\b(because|therefore|trade-?off|however|first|second)\b", pred, re.I):
            score += 0.2
        if len(pred) > 240:
            score += 0.2
    else:
        score += 0.4
    return min(1.0, score)


_REFUSAL = re.compile(
    r"i don't know|too complex|as a small model|can't help|cannot help|"
    r"i'm unable|i am unable|as an ai",
    re.I,
)
_HEDGE = re.compile(r"\b(maybe|perhaps|not sure|i think|might be|possibly)\b", re.I)


def looks_degraded(pred: str, difficulty: int) -> bool:
    text = pred.strip()
    if not text:
        return True
    lower = text.lower()
    if _REFUSAL.search(lower):
        return True
    # Thin answers for hard prompts (L1–2 allow short correct answers).
    min_len = 80 if difficulty >= 4 else 36 if difficulty >= 3 else 1
    if len(text) < min_len:
        return True
    # Hedging on complex prompts is a soft fail signal.
    if difficulty >= 4 and _HEDGE.search(lower) and len(text) < 160:
        return True
    # Truncation / unfinished code fence.
    ends_mid_word = bool(re.search(r"\b[a-z]{1,2}$", text, re.I))
    ends_sentence = bool(re.search(r"[.!?)]$", text))
    if re.search(r"```[^`]*$", text) or (len(text) > 200 and ends_mid_word and not ends_sentence):
        return True
    return False


def score_answer(
    pred: str,
    *,
    gold: str = "",
    must_include: list[str] | None = None,
    difficulty: int = 3,
    threshold: float = 0.62,
) -> QualityScore:
    must_include = must_include or []
    f1 = lexical_f1(pred, gold) if gold else 0.7
    cov = coverage(pred, must_include)
    struct = structure_score(pred, difficulty)
    if gold and must_include:
        blended = 0.4 * f1 + 0.4 * cov + 0.2 * struct
    elif must_include:
        blended = 0.65 * cov + 0.35 * struct
    elif gold:
        blended = 0.7 * f1 + 0.3 * struct
    else:
        blended = struct
    degraded = looks_degraded(pred, difficulty) or blended < threshold
    notes: list[str] = []
    if cov < 1 and must_include:
        notes.append("missing required concepts")
    if looks_degraded(pred, difficulty):
        notes.append("answer too thin or refusal for this difficulty")
    if blended < threshold:
        notes.append("below quality threshold vs gold")
    return QualityScore(
        score=blended,
        lexical_f1=f1,
        coverage=cov,
        structure=struct,
        degraded=degraded,
        notes=notes,
    )
