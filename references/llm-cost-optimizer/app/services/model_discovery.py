from __future__ import annotations
from decimal import Decimal
from typing import Any

from app.core.schemas import ModelPricing, ModelProfile, ProviderConnection, TokenPrice
from app.services.client_factory import OpenAIClientFactory


def parse_token_price(value: str | float | int | None) -> TokenPrice | None:
    if value is None:
        return None
    return TokenPrice(usd_per_token=Decimal(str(value)))


class ModelNormalizer:
    @staticmethod
    def normalize(provider_id: str, model: Any) -> ModelProfile:
        pricing_data = getattr(model, "pricing", None) or {}
        pricing = ModelPricing(
            prompt=parse_token_price(pricing_data.get("prompt")),
            completion=parse_token_price(pricing_data.get("completion")),
            input_cache_read=parse_token_price(pricing_data.get("input_cache_read")),
            image=parse_token_price(pricing_data.get("image")),
            request=parse_token_price(pricing_data.get("request")),
        )
        return ModelProfile(
            provider_id=provider_id,
            model_id=model.id,
            display_name=getattr(model, "name", None) or model.id,
            description=getattr(model, "description", None),
            context_length=getattr(model, "context_length", None),
            max_completion_tokens=getattr(model, "max_completion_tokens", None),
            pricing=pricing,
            supported_features=tuple(getattr(model, "supported_features", []) or []),
            supported_sampling_parameters=tuple(
                getattr(model, "supported_sampling_parameters", []) or []
            ),
            input_modalities=tuple(getattr(model, "input_modalities", []) or []),
            output_modalities=tuple(getattr(model, "output_modalities", []) or []),
        )


class ModelDiscoveryService:
    def __init__(self, client_factory: OpenAIClientFactory):
        self.client_factory = client_factory

    def discover(self, connection: ProviderConnection) -> list[ModelProfile]:
        client = self.client_factory.create(connection)
        response = client.models.list()
        return [
            ModelNormalizer.normalize(connection.provider_id, model)
            for model in response.data
        ]
