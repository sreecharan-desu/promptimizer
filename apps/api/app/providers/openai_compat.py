from __future__ import annotations

import ipaddress
import socket
from typing import Any
from urllib.parse import urlparse

import httpx


class ProviderError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _join(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _private_ip(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast


def assert_public_base_url(base_url: str) -> str:
    parsed = urlparse(base_url.strip())
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not host or host in {"localhost", "metadata.google.internal"}:
        raise ProviderError(400, "Provider URL must be a public https host.")
    try:
        ipaddress.ip_address(host)
        literal = True
    except ValueError:
        literal = False
    if literal and _private_ip(host):
        raise ProviderError(400, "Provider URL must be a public https host.")
    if not literal:
        try:
            infos = socket.getaddrinfo(host, None)
        except socket.gaierror as exc:
            raise ProviderError(400, "Provider host could not be resolved.") from exc
        if any(_private_ip(info[4][0]) for info in infos):
            raise ProviderError(400, "Provider URL must be a public https host.")
    return base_url.rstrip("/")


async def list_models(base_url: str, api_key: str) -> list[dict[str, Any]]:
    base_url = assert_public_base_url(base_url)
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
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
    base_url = assert_public_base_url(base_url)
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as client:
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
