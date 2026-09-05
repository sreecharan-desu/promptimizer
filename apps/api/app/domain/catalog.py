from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

Tier = Literal["economy", "standard", "frontier"]

_PRICING_PATH = Path(__file__).resolve().parent.parent / "data" / "pricing.json"

_UUID_MODEL = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.I,
)
_ECONOMY = re.compile(
    r"(mini|nano|haiku|tiny|lite|instant|8b|7b|small|flash-lite|gemma|gpt-3\.5)",
    re.I,
)
_FRONTIER = re.compile(
    r"(gpt-4(?!o-mini|\.1-mini|\.1-nano)|gpt-4o$|gpt-4\.1$|opus|o1$|o3$|405b|400b|ultra|reasoning|frontier)",
    re.I,
)
_STANDARD = re.compile(r"(sonnet|flash$|70b|72b|32b|o1-mini|o3-mini|o4-mini|reasoner)", re.I)


@dataclass
class ModelInfo:
    id: str
    owned_by: str = "unknown"
    input_per_1m: float | None = None
    output_per_1m: float | None = None
    tier: Tier = "standard"
    source: str = "heuristic"
    selected: bool = True


@dataclass
class Fleet:
    models: list[ModelInfo] = field(default_factory=list)
    baseline_model: str | None = None

    def by_id(self, model_id: str) -> ModelInfo | None:
        for model in self.models:
            if model.id == model_id:
                return model
        return None

    def of_tier(self, tier: Tier) -> list[ModelInfo]:
        return [m for m in self.models if m.selected and m.tier == tier]

    def cheapest(self, tier: Tier | None = None) -> ModelInfo | None:
        pool = [m for m in self.models if m.selected]
        if tier:
            pool = [m for m in pool if m.tier == tier]
        if not pool:
            return None
        return min(pool, key=lambda m: _blend_price(m))

    def frontier(self) -> ModelInfo | None:
        if self.baseline_model:
            found = self.by_id(self.baseline_model)
            if found:
                return found
        return self.cheapest("frontier") or max(
            (m for m in self.models if m.selected),
            key=lambda m: _blend_price(m),
            default=None,
        )

    def as_dicts(self) -> list[dict[str, Any]]:
        return [
            {
                "id": m.id,
                "owned_by": m.owned_by,
                "input_per_1m": m.input_per_1m,
                "output_per_1m": m.output_per_1m,
                "tier": m.tier,
                "source": m.source,
                "selected": m.selected,
            }
            for m in self.models
        ]


def load_pricing() -> dict[str, Any]:
    return json.loads(_PRICING_PATH.read_text())


def _blend_price(model: ModelInfo) -> float:
    inp = model.input_per_1m if model.input_per_1m is not None else 2.0
    out = model.output_per_1m if model.output_per_1m is not None else 6.0
    return inp * 0.4 + out * 0.6


def lookup_pricing(model_id: str) -> dict[str, Any] | None:
    table = load_pricing()["models"]
    if model_id in table:
        return table[model_id]
    lowered = model_id.lower()
    for key, value in table.items():
        if key in lowered or lowered.endswith(key):
            return value
    return None


def infer_tier(model_id: str, priced: dict[str, Any] | None = None) -> tuple[Tier, str]:
    if priced and priced.get("tier"):
        return priced["tier"], "catalog"
    if _ECONOMY.search(model_id):
        return "economy", "heuristic"
    if _FRONTIER.search(model_id):
        return "frontier", "heuristic"
    if _STANDARD.search(model_id):
        return "standard", "heuristic"
    if priced:
        blend = priced["input"] * 0.4 + priced["output"] * 0.6
        if blend < 0.8:
            return "economy", "price"
        if blend > 6:
            return "frontier", "price"
        return "standard", "price"
    return "standard", "heuristic"


def is_uuid_model_id(model_id: str) -> bool:
    """Baseten /models mixes slugs with per-account deployment UUIDs — skip those."""
    return bool(_UUID_MODEL.match(model_id.strip()))


def fleet_from_provider_models(raw_models: list[dict[str, Any]]) -> Fleet:
    models: list[ModelInfo] = []
    seen: set[str] = set()
    for item in raw_models:
        model_id = item.get("id") or item.get("name")
        if not model_id or model_id in seen:
            continue
        if is_uuid_model_id(str(model_id)):
            continue
        skip_tokens = ("embed", "whisper", "tts", "dall", "image", "moderation")
        if any(skip in model_id.lower() for skip in skip_tokens):
            continue
        seen.add(model_id)
        priced = lookup_pricing(model_id)
        tier, source = infer_tier(model_id, priced)
        models.append(
            ModelInfo(
                id=model_id,
                owned_by=str(item.get("owned_by") or item.get("ownedBy") or "provider"),
                input_per_1m=priced["input"] if priced else None,
                output_per_1m=priced["output"] if priced else None,
                tier=tier,
                source=source,
            )
        )
    models.sort(key=lambda m: (_tier_rank(m.tier), _blend_price(m), m.id))
    fleet = Fleet(models=models)
    frontier = fleet.cheapest("frontier") or (models[-1] if models else None)
    fleet.baseline_model = frontier.id if frontier else None
    return fleet


def apply_tier_overrides(fleet: Fleet, overrides: dict[str, str]) -> Fleet:
    for model in fleet.models:
        if model.id in overrides and overrides[model.id] in {"economy", "standard", "frontier"}:
            model.tier = overrides[model.id]  # type: ignore[assignment]
            model.source = "user"
    return fleet


def _tier_rank(tier: Tier) -> int:
    return {"economy": 0, "standard": 1, "frontier": 2}[tier]
