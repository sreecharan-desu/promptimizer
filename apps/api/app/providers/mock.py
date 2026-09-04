from __future__ import annotations

import time
from typing import Any

from app.domain.classifier import Classification
from app.domain.costing import estimate_tokens


def _nano_answer(prompt: str, classification: Classification) -> str:
    if classification.complexity >= 4 or classification.quality_risk == "high":
        return (
            "This looks too complex for the economy model. "
            "I don't know how to give a complete, reliable answer."
        )
    lowered = prompt.lower()
    if "capital of france" in lowered:
        return "Paris is the capital of France."
    if "fahrenheit" in lowered:
        return "37.8"
    if "http stand" in lowered:
        return "HyperText Transfer Protocol"
    if "17" in prompt and "24" in prompt:
        return "408"
    if "rest api" in lowered:
        return (
            "A REST API is an HTTP interface that exposes resources through uniform methods. "
            "Clients send stateless requests and receive standard status codes."
        )
    return prompt[:180]


def _flash_answer(prompt: str, classification: Classification) -> str:
    if classification.complexity >= 5:
        return (
            "I can outline this, but as a small model I may miss failure modes. "
            "A frontier model should review the design."
        )
    if classification.category == "code_generation" and "merge_sorted" in prompt:
        return (
            "def merge_sorted(a, b):\n"
            '    """Merge two sorted lists in linear time."""\n'
            "    i = j = 0\n    out = []\n"
            "    while i < len(a) and j < len(b):\n"
            "        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n"
            "        else:\n            out.append(b[j]); j += 1\n"
            "    out.extend(a[i:]); out.extend(b[j:])\n    return out"
        )
    if "tcp" in prompt.lower() and "udp" in prompt.lower():
        return (
            "TCP is reliable and ordered; UDP is connectionless and lower latency. "
            "UDP is the better choice for live video, DNS, and multiplayer game state."
        )
    if "expected number of flips" in prompt.lower():
        return "Let E be expected flips. E = 1 + (1/2)E, so E = 2."
    if "despliegue" in prompt.lower() or "trad" in prompt.lower():
        return "The deployment failed because the database secret was not mounted into the pod."
    return _nano_answer(prompt, classification) + "\n\n(Additional context from the standard tier.)"


def _frontier_answer(prompt: str, classification: Classification) -> str:
    table = {
        "rate limiter": (
            "Use a distributed token bucket: each edge holds a local slice of tokens, "
            "replenished from a Redis cluster with sliding-window fallback. Keys hash to shards. "
            "Accept eventual consistency on refill to keep p99 low; on Redis loss, fail closed for "
            "paid keys. Log decisions for quota reconciliation."
        ),
        "infinitely many prime": (
            "Euclid: if p1..pk were all primes, N = p1..pk + 1 is not divisible by any pi, "
            "so it has a new prime factor — contradiction. Twin primes are pairs (p, p+2); "
            "the Euclid construction produces one new prime, not a pair with difference 2, "
            "so it does not prove infinitely many twins."
        ),
        "goroutine": (
            "Go maps are not goroutine-safe; concurrent write/write is a race and can panic. "
            "Protect with a mutex, or shard into N maps by key hash with per-shard locks. "
            "Atomics cannot protect map structure."
        ),
        "cut LLM cost": (
            "Classify tickets by risk and difficulty. Economy models handle FAQ; frontier "
            "handles refunds, legal, and medical-adjacent. Keep a gold eval set and online "
            "eval so silent quality regressions auto-escalate that category. Prompt-cache "
            "the policy. Never optimize cost without a quality gate."
        ),
        "peeking": (
            "Daily peeking inflates Type I error; p=0.048 after two weeks of looks is not valid. "
            "Use a pre-registered sample size or sequential testing with alpha spending. "
            "Do not ship on a peeked p-value. Multiple comparisons need correction."
        ),
        "first missing": (
            "The given code is O(n^2) because membership scans the list, and it allocates extra "
            "memory. Place each value v at index v-1 in-place, then scan for the first index "
            "whose value is not index+1 — O(n) time and O(1) extra space."
        ),
    }
    blob = prompt.lower()
    for key, value in table.items():
        if key.lower() in blob:
            return value
    if classification.complexity <= 2:
        return _nano_answer(prompt, classification)
    return _flash_answer(prompt, classification)


def mock_complete(
    *,
    model: str,
    messages: list[dict[str, Any]],
    classification: Classification,
) -> dict[str, Any]:
    prompt = ""
    for message in messages:
        if message.get("role") == "user":
            content = message.get("content", "")
            prompt = content if isinstance(content, str) else str(content)
    if model.endswith("nano"):
        text = _nano_answer(prompt, classification)
    elif model.endswith("flash"):
        text = _flash_answer(prompt, classification)
    else:
        text = _frontier_answer(prompt, classification)

    prompt_tokens = estimate_tokens("\n".join(str(m.get("content", "")) for m in messages))
    completion_tokens = estimate_tokens(text)
    created = int(time.time())
    return {
        "id": f"chatcmpl-mock-{created}",
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def mock_models() -> list[dict[str, Any]]:
    return [
        {"id": "promptimizer-nano", "object": "model", "owned_by": "promptimizer"},
        {"id": "promptimizer-flash", "object": "model", "owned_by": "promptimizer"},
        {"id": "promptimizer-frontier", "object": "model", "owned_by": "promptimizer"},
    ]
