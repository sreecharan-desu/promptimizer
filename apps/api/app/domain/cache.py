from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from app.core.config import get_settings


def prefix_hash(messages: list[dict[str, Any]]) -> tuple[str, int, list[dict[str, Any]]]:
    """Cache system + long context blocks. Returns hash, cached-token estimate, prefix."""
    prefix: list[dict[str, Any]] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        if role == "system":
            prefix.append(message)
            continue
        if role == "user" and isinstance(content, str) and len(content) >= 800:
            prefix.append({"role": "user", "content": content[:800], "name": message.get("name")})
    raw = json.dumps(prefix, sort_keys=True, ensure_ascii=False)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    tokens = max(0, round(len(raw) / 4)) if prefix else 0
    return digest, tokens, prefix


def completion_hash(messages: list[dict[str, Any]], model: str) -> str:
    raw = json.dumps({"messages": messages, "model": model}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


class PromptCache:
    def __init__(self) -> None:
        self._memory: dict[str, tuple[float, Any]] = {}
        self._hits = 0
        self._misses = 0
        self._redis = None
        settings = get_settings()
        self.ttl = settings.cache_ttl_seconds
        self.backend = settings.cache_backend
        if self.backend == "redis":
            try:
                import redis

                self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self.backend = "memory"
                self._redis = None

    def get(self, key: str) -> Any | None:
        if self._redis is not None:
            raw = self._redis.get(f"pm:cache:{key}")
            if raw is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(raw)
        item = self._memory.get(key)
        if item is None or item[0] < time.time():
            self._memory.pop(key, None)
            self._misses += 1
            return None
        self._hits += 1
        return item[1]

    def set(self, key: str, value: Any) -> None:
        if self._redis is not None:
            self._redis.setex(f"pm:cache:{key}", self.ttl, json.dumps(value))
            return
        self._memory[key] = (time.time() + self.ttl, value)

    def exists(self, key: str) -> bool:
        if self._redis is not None:
            return bool(self._redis.exists(f"pm:cache:{key}"))
        item = self._memory.get(key)
        return bool(item and item[0] >= time.time())

    def remember_prefix(self, digest: str) -> bool:
        """True if this system/context prefix has been seen (prompt-cache hit)."""
        key = f"prefix:{digest}"
        if self.exists(key):
            self._hits += 1
            return True
        self.set(key, {"seen": True})
        self._misses += 1
        return False

    def stats(self) -> dict[str, Any]:
        total = self._hits + self._misses
        return {
            "backend": self.backend,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total else 0.0,
        }


cache = PromptCache()
