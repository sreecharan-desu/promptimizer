from __future__ import annotations

from typing import Any

PROVIDERS: list[dict[str, str]] = [
    {
        "id": "openai",
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "env": "OPENAI_API_KEY",
    },
    {
        "id": "groq",
        "label": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "env": "GROQ_API_KEY",
    },
    {
        "id": "baseten",
        "label": "Baseten",
        "base_url": "https://inference.baseten.co/v1",
        "env": "BASETEN_API_KEY",
    },
    {
        "id": "openrouter",
        "label": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "env": "OPENROUTER_API_KEY",
    },
    {
        "id": "together",
        "label": "Together",
        "base_url": "https://api.together.xyz/v1",
        "env": "TOGETHER_API_KEY",
    },
    {
        "id": "fireworks",
        "label": "Fireworks",
        "base_url": "https://api.fireworks.ai/inference/v1",
        "env": "FIREWORKS_API_KEY",
    },
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "env": "DEEPSEEK_API_KEY",
    },
    {
        "id": "mistral",
        "label": "Mistral",
        "base_url": "https://api.mistral.ai/v1",
        "env": "MISTRAL_API_KEY",
    },
    {
        "id": "cerebras",
        "label": "Cerebras",
        "base_url": "https://api.cerebras.ai/v1",
        "env": "CEREBRAS_API_KEY",
    },
    {
        "id": "xai",
        "label": "xAI",
        "base_url": "https://api.x.ai/v1",
        "env": "XAI_API_KEY",
    },
    {
        "id": "google",
        "label": "Google",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "env": "GOOGLE_API_KEY",
    },
    {
        "id": "perplexity",
        "label": "Perplexity",
        "base_url": "https://api.perplexity.ai",
        "env": "PERPLEXITY_API_KEY",
    },
    {
        "id": "nvidia",
        "label": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "env": "NVIDIA_API_KEY",
    },
    {
        "id": "sambanova",
        "label": "SambaNova",
        "base_url": "https://api.sambanova.ai/v1",
        "env": "SAMBANOVA_API_KEY",
    },
    {
        "id": "hyperbolic",
        "label": "Hyperbolic",
        "base_url": "https://api.hyperbolic.xyz/v1",
        "env": "HYPERBOLIC_API_KEY",
    },
    {
        "id": "moonshot",
        "label": "Moonshot",
        "base_url": "https://api.moonshot.ai/v1",
        "env": "MOONSHOT_API_KEY",
    },
]


def find_provider(name: str | None) -> dict[str, str] | None:
    if not name:
        return None
    needle = name.strip().lower()
    for item in PROVIDERS:
        if item["id"] == needle or item["label"].lower() == needle:
            return item
    return None


def resolve_base_url(
    *,
    provider: str | None,
    base_url: str | None,
) -> tuple[str | None, dict[str, str] | None]:
    if base_url and base_url.strip():
        return base_url.strip().rstrip("/"), find_provider(provider)
    found = find_provider(provider)
    if found:
        return found["base_url"], found
    return None, None


def public_catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": p["id"],
            "label": p["label"],
            "base_url": p["base_url"],
            "env": p["env"],
        }
        for p in PROVIDERS
    ]
