from pathlib import Path
import yaml
from app.core.schemas import ProviderDefinition


class ProviderRegistry:
    def __init__(self, providers: dict[str, ProviderDefinition]):
        self._providers = dict(providers)

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ProviderRegistry":
        raw = yaml.safe_load(Path(path).read_text()) or {}
        providers = {}
        for item in raw.get("providers", []):
            p = ProviderDefinition(**item)
            providers[p.provider_id] = p
        return cls(providers)

    def get(self, provider_id: str) -> ProviderDefinition:
        try:
            return self._providers[provider_id]
        except KeyError as exc:
            raise ValueError(f"Unsupported provider: '{provider_id}'") from exc

    def exists(self, provider_id: str) -> bool:
        return provider_id in self._providers

    def list(self) -> list[ProviderDefinition]:
        return list(self._providers.values())
