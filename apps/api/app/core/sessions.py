from __future__ import annotations

import base64
import json
import secrets
import time
from dataclasses import asdict, dataclass, field
from typing import Any

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import get_settings
from app.domain.catalog import Fleet, ModelInfo, apply_tier_overrides, mock_fleet


def _fernet() -> Fernet:
    settings = get_settings()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"promptimizer-byok-v1",
        iterations=200_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.session_secret.encode()))
    return Fernet(key)


@dataclass
class ProviderSession:
    id: str
    mode: str
    label: str
    base_url: str
    api_key_encrypted: str
    fleet: dict[str, Any]
    baseline_model: str | None
    created_at: float
    stats: dict[str, Any] = field(default_factory=lambda: {
        "requests": 0,
        "actual_usd": 0.0,
        "baseline_usd": 0.0,
        "saved_usd": 0.0,
        "cache_hits": 0,
        "escalations": 0,
        "quality_fails": 0,
    })

    def api_key(self) -> str:
        if self.mode == "mock":
            return ""
        return _fernet().decrypt(self.api_key_encrypted.encode()).decode()

    def fleet_obj(self) -> Fleet:
        models = [
            ModelInfo(
                id=m["id"],
                owned_by=m.get("owned_by", "provider"),
                input_per_1m=m.get("input_per_1m"),
                output_per_1m=m.get("output_per_1m"),
                tier=m["tier"],
                source=m.get("source", "heuristic"),
                selected=m.get("selected", True),
            )
            for m in self.fleet.get("models", [])
        ]
        return Fleet(models=models, baseline_model=self.baseline_model)


class SessionStore:
    def __init__(self) -> None:
        self._memory: dict[str, str] = {}
        self._redis = None
        settings = get_settings()
        if settings.cache_backend == "redis":
            try:
                import redis

                self._redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def _ttl(self) -> int:
        return get_settings().session_ttl_seconds

    def put(self, session: ProviderSession) -> None:
        raw = json.dumps(asdict(session))
        if self._redis is not None:
            self._redis.setex(f"pm:sess:{session.id}", self._ttl(), raw)
            return
        self._memory[session.id] = raw

    def get(self, session_id: str) -> ProviderSession | None:
        raw = None
        if self._redis is not None:
            raw = self._redis.get(f"pm:sess:{session_id}")
        else:
            raw = self._memory.get(session_id)
        if not raw:
            return None
        data = json.loads(raw)
        return ProviderSession(**data)

    def delete(self, session_id: str) -> None:
        if self._redis is not None:
            self._redis.delete(f"pm:sess:{session_id}")
        self._memory.pop(session_id, None)


sessions = SessionStore()


def create_mock_session(label: str = "Promptimizer simulator") -> ProviderSession:
    fleet = mock_fleet()
    session = ProviderSession(
        id=f"sess_{secrets.token_urlsafe(16)}",
        mode="mock",
        label=label,
        base_url="mock://promptimizer",
        api_key_encrypted="",
        fleet={"models": fleet.as_dicts()},
        baseline_model=fleet.baseline_model,
        created_at=time.time(),
    )
    sessions.put(session)
    return session


def create_byok_session(
    *,
    label: str,
    base_url: str,
    api_key: str,
    fleet: Fleet,
) -> ProviderSession:
    encrypted = _fernet().encrypt(api_key.encode()).decode()
    session = ProviderSession(
        id=f"sess_{secrets.token_urlsafe(16)}",
        mode="byok",
        label=label,
        base_url=base_url.rstrip("/"),
        api_key_encrypted=encrypted,
        fleet={"models": fleet.as_dicts()},
        baseline_model=fleet.baseline_model,
        created_at=time.time(),
    )
    sessions.put(session)
    return session


def public_session(session: ProviderSession) -> dict[str, Any]:
    return {
        "session_id": session.id,
        "mode": session.mode,
        "label": session.label,
        "base_url": session.base_url if session.mode == "mock" else _mask_url(session.base_url),
        "models": session.fleet.get("models", []),
        "baseline_model": session.baseline_model,
        "stats": session.stats,
        "created_at": session.created_at,
    }


def _mask_url(url: str) -> str:
    return url


def update_session_fleet(
    session: ProviderSession,
    *,
    overrides: dict[str, str] | None = None,
    baseline_model: str | None = None,
    selected: dict[str, bool] | None = None,
) -> ProviderSession:
    fleet = session.fleet_obj()
    if overrides:
        apply_tier_overrides(fleet, overrides)
    if selected:
        for model in fleet.models:
            if model.id in selected:
                model.selected = bool(selected[model.id])
    if baseline_model:
        fleet.baseline_model = baseline_model
        session.baseline_model = baseline_model
    session.fleet = {"models": fleet.as_dicts()}
    sessions.put(session)
    return session


def touch_stats(session: ProviderSession, **delta: float) -> None:
    for key, value in delta.items():
        session.stats[key] = session.stats.get(key, 0) + value
    sessions.put(session)
