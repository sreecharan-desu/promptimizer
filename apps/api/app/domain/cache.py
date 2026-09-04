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
        redis_url = settings.upstash_redis_url or settings.redis_url
        if self.backend == "redis" or settings.upstash_redis_rest_url:
            if redis_url and not settings.upstash_redis_rest_url:
                try:
                    import redis

                    self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                    self._redis.ping()
                    self.backend = "redis"
                except Exception:
                    self.backend = "memory"
                    self._redis = None
            elif settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
                self.backend = "upstash"
                self._redis = None

    def _upstash(self, *parts: str) -> Any | None:
        settings = get_settings()
        url = settings.upstash_redis_rest_url.rstrip("/")
        token = settings.upstash_redis_rest_token
        if not url or not token:
            return None
        try:
            import httpx

            response = httpx.post(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=list(parts),
                timeout=5.0,
            )
            if not response.is_success:
                return None
            return response.json().get("result")
        except Exception:
            return None

    def _ns(self, key: str, owner: str | None = None) -> str:
        scope = "".join(ch if ch.isalnum() or ch in ":_-" else "_" for ch in (owner or "anon"))[:96]
        return f"pm:u:{scope or 'anon'}:cache:{key}"

    def get(self, key: str, owner: str | None = None) -> Any | None:
        full = self._ns(key, owner)
        if self.backend == "upstash":
            raw = self._upstash("GET", full)
            if raw is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(raw) if isinstance(raw, str) else raw
        if self._redis is not None:
            raw = self._redis.get(full)
            if raw is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(raw)
        item = self._memory.get(full)
        if item is None or item[0] < time.time():
            self._memory.pop(full, None)
            self._misses += 1
            return None
        self._hits += 1
        return item[1]

    def set(self, key: str, value: Any, owner: str | None = None) -> None:
        full = self._ns(key, owner)
        if self.backend == "upstash":
            self._upstash("SET", full, json.dumps(value), "EX", str(self.ttl))
            return
        if self._redis is not None:
            self._redis.setex(full, self.ttl, json.dumps(value))
            return
        self._memory[full] = (time.time() + self.ttl, value)

    def exists(self, key: str, owner: str | None = None) -> bool:
        full = self._ns(key, owner)
        if self.backend == "upstash":
            return bool(self._upstash("EXISTS", full))
        if self._redis is not None:
            return bool(self._redis.exists(full))
        item = self._memory.get(full)
        return bool(item and item[0] >= time.time())

    def remember_prefix(self, digest: str, owner: str | None = None) -> bool:
        """True if this system/context prefix has been seen (prompt-cache hit)."""
        key = f"prefix:{digest}"
        if self.exists(key, owner):
            self._hits += 1
            return True
        self.set(key, {"seen": True}, owner)
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
