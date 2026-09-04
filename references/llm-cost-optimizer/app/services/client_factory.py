from openai import OpenAI
from app.core.providers import ProviderRegistry
from app.core.schemas import ProviderConnection


class OpenAIClientFactory:
    def __init__(self, provider_registry: ProviderRegistry):
        self.provider_registry = provider_registry

    def create(self, connection: ProviderConnection) -> OpenAI:
        provider = self.provider_registry.get(connection.provider_id)
        return OpenAI(
            api_key=connection.api_key.get_secret_value(),
            base_url=provider.base_url,
        )
