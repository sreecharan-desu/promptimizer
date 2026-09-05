from __future__ import annotations

import time
from typing import Literal

from fastapi import HTTPException, Request

Kind = Literal["chat", "connect", "auth"]

_memory: dict[str, dict[str, float | int]] = {}

_LIMITS: dict[Kind, int] = {
    "chat": 120,
    "connect": 30,
    "auth": 20,
}
_WINDOW_MS = 60_000


def _client_ip(request: Request) -> str:
    xf = request.headers.get("x-forwarded-for")
    if xf:
        return xf.split(",")[0].strip() or "anon"
    if request.client:
        return request.client.host or "anon"
    return "anon"


def check_rate_limit(kind: Kind, identity: str) -> None:
    """Fixed-window in-memory rate limit. Raises 429 when exceeded."""
    limit = _LIMITS[kind]
    now = time.time() * 1000
    key = f"pm:rl:{kind}:{identity or 'anon'}"
    cur = _memory.get(key)
    if cur is None or float(cur["reset"]) < now:
        cur = {"count": 0, "reset": now + _WINDOW_MS}
        _memory[key] = cur
    cur["count"] = int(cur["count"]) + 1
    if int(cur["count"]) > limit:
        retry = max(1, int((float(cur["reset"]) - now) / 1000))
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again shortly.",
            headers={"Retry-After": str(retry)},
        )


async def rate_limit_chat(request: Request) -> None:
    check_rate_limit("chat", _client_ip(request))


async def rate_limit_connect(request: Request) -> None:
    check_rate_limit("connect", _client_ip(request))
