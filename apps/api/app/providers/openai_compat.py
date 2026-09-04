from __future__ import annotations

from typing import Any

import httpx


class ProviderError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _join(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


async def list_models(base_url: str, api_key: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            _join(base_url, "/models"),
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if response.status_code >= 400:
        raise ProviderError(response.status_code, response.text[:800])
    payload = response.json()
    data = payload.get("data", payload if isinstance(payload, list) else [])
    return [item for item in data if isinstance(item, dict)]


async def chat_completions(
    *,
    base_url: str,
    api_key: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            _join(base_url, "/chat/completions"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
    if response.status_code >= 400:
        raise ProviderError(response.status_code, response.text[:800])
    return response.json()
