"""cache, rate limiter, sessions, openai-compat client and semantic-cache logic."""

from __future__ import annotations

import socket
import time
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from app.core import rate_limit
from app.core.sessions import _mask_url, create_byok_session, sessions, touch_stats
from app.domain import semantic_cache as sc
from app.domain.cache import PromptCache, completion_hash, prefix_hash
from app.domain.catalog import fleet_from_provider_models
from app.providers import openai_compat
from app.providers.openai_compat import ProviderError, assert_public_base_url

# ---- prompt cache ----


def test_prefix_hash_only_counts_system_and_long_user_context():
    d1, t1, p1 = prefix_hash([{"role": "user", "content": "short"}])
    assert t1 == 0 and p1 == []
    d2, t2, p2 = prefix_hash(
        [{"role": "system", "content": "be terse"}, {"role": "user", "content": "x" * 900}]
    )
    assert t2 > 0 and len(p2) == 2 and len(p2[1]["content"]) == 800
    assert d1 != d2


def test_completion_hash_depends_on_model():
    m = [{"role": "user", "content": "hi"}]
    assert completion_hash(m, "a") != completion_hash(m, "b")
    assert completion_hash(m, "a") == completion_hash(m, "a")


def test_memory_cache_get_set_expiry_and_owner_isolation():
    c = PromptCache()
    assert c.get("k", "alice") is None
    c.set("k", {"v": 1}, "alice")
    assert c.get("k", "alice") == {"v": 1}
    assert c.get("k", "bob") is None  # owner-scoped
    assert c.exists("k", "alice")
    full = c._ns("k", "alice")
    c._memory[full] = (time.time() - 1, {"v": 1})  # force expiry
    assert c.get("k", "alice") is None
    s = c.stats()
    assert s["hits"] == 1 and s["misses"] == 3


def test_owner_namespace_is_sanitised():
    c = PromptCache()
    assert c._ns("k", "a b/../c") == "pm:u:a_b____c:cache:k"
    assert c._ns("k", None) == "pm:u:anon:cache:k"


def test_remember_prefix_hits_second_time():
    c = PromptCache()
    assert c.remember_prefix("abc", "o") is False
    assert c.remember_prefix("abc", "o") is True


# ---- rate limit ----


def test_rate_limit_window_and_retry_after():
    rate_limit._memory.clear()
    for _ in range(20):
        rate_limit.check_rate_limit("auth", "1.2.3.4")
    with pytest.raises(HTTPException) as exc:
        rate_limit.check_rate_limit("auth", "1.2.3.4")
    assert exc.value.status_code == 429
    assert int(exc.value.headers["Retry-After"]) >= 1
    rate_limit.check_rate_limit("auth", "5.6.7.8")  # other ip unaffected
    key = "pm:rl:auth:1.2.3.4"
    rate_limit._memory[key]["reset"] = 0  # window elapsed
    rate_limit.check_rate_limit("auth", "1.2.3.4")
    rate_limit._memory.clear()


def test_client_ip_falls_back_to_anon():
    assert rate_limit._client_ip(SimpleNamespace(client=None)) == "anon"
    assert (
        rate_limit._client_ip(SimpleNamespace(client=SimpleNamespace(host="9.9.9.9"))) == "9.9.9.9"
    )


# ---- sessions ----


def test_session_encrypts_key_and_expires():
    fleet = fleet_from_provider_models([{"id": "m1"}, {"id": "m2-frontier"}])
    s = create_byok_session(label="l", base_url="https://x.test/v1/", api_key="sk-1", fleet=fleet)
    assert "sk-1" not in s.api_key_encrypted
    assert sessions.get(s.id).api_key() == "sk-1"
    touch_stats(s, requests=2, saved_usd=0.5)
    assert sessions.get(s.id).stats["requests"] == 2
    raw, _ = sessions._memory[s.id]
    sessions._memory[s.id] = (raw, time.time() - 1)
    assert sessions.get(s.id) is None
    assert sessions.get("missing") is None


def test_mask_url_strips_credentials_and_query():
    assert _mask_url("https://user:pw@api.x.com:8443/v1/?key=1#f") == "https://api.x.com:8443/v1"


# ---- openai-compatible client ----


@pytest.mark.parametrize(
    "url",
    [
        "http://api.openai.com/v1",
        "https://localhost/v1",
        "https://127.0.0.1/v1",
        "https://10.0.0.5/v1",
        "https://169.254.169.254/latest",
        "https://metadata.google.internal/",
    ],
)
def test_ssrf_guard_rejects_private_targets(url):
    with pytest.raises(ProviderError):
        assert_public_base_url(url)


def test_ssrf_guard_resolves_hostnames(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda h, p: [(0, 0, 0, "", ("10.1.1.1", 0))])
    with pytest.raises(ProviderError):
        assert_public_base_url("https://evil.example/v1")
    monkeypatch.setattr(socket, "getaddrinfo", lambda h, p: [(0, 0, 0, "", ("8.8.8.8", 0))])
    assert assert_public_base_url("https://ok.example/v1/") == "https://ok.example/v1"

    def nxdomain(h, p):
        raise socket.gaierror("nope")

    monkeypatch.setattr(socket, "getaddrinfo", nxdomain)
    with pytest.raises(ProviderError, match="resolved"):
        assert_public_base_url("https://missing.example/v1")


def _mock_transport(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(socket, "getaddrinfo", lambda h, p: [(0, 0, 0, "", ("8.8.8.8", 0))])
    monkeypatch.setattr(
        openai_compat.httpx,
        "AsyncClient",
        lambda **kw: real(transport=httpx.MockTransport(handler), **kw),
    )


async def test_list_models_and_chat_happy_path(monkeypatch):
    seen = []

    def handler(req: httpx.Request):
        seen.append((req.method, str(req.url), req.headers["authorization"]))
        if req.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": [{"id": "a"}, "junk"]})
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    _mock_transport(monkeypatch, handler)
    assert await openai_compat.list_models("https://p.example/v1", "k") == [{"id": "a"}]
    out = await openai_compat.chat_completions(
        base_url="https://p.example/v1", api_key="k", body={"model": "a"}
    )
    assert out["choices"][0]["message"]["content"] == "ok"
    assert seen[0] == ("GET", "https://p.example/v1/models", "Bearer k")
    assert seen[1][1] == "https://p.example/v1/chat/completions"


async def test_provider_errors_propagate_status(monkeypatch):
    _mock_transport(monkeypatch, lambda req: httpx.Response(429, text="slow down"))
    with pytest.raises(ProviderError) as exc:
        await openai_compat.list_models("https://p.example/v1", "k")
    assert exc.value.status_code == 429
    with pytest.raises(ProviderError):
        await openai_compat.chat_completions(base_url="https://p.example/v1", api_key="k", body={})


# ---- semantic cache decision logic ----


def _entry(prompt, answer="cached answer"):
    return sc.SemanticEntry("e1", prompt, answer, "m", "economy", 0.9, 0.0)


def test_canonicalize_arithmetic_paraphrases():
    assert sc._canonicalize("what is 12 x 7?") == sc._canonicalize("12 times 7")
    assert sc._canonicalize("Hello  World...") == "hello world"


def test_entities_compatible_numbers_and_negation():
    assert sc._entities_compatible("price of 3 apples", "price of 3 apples please")
    assert not sc._entities_compatible("price of 3 apples", "price of 4 apples")
    assert not sc._entities_compatible("is it safe", "is it not safe")
    assert sc._entities_compatible("is it safe", "is this safe")


def test_pick_modes():
    assert sc._pick("q", []) is None
    exact = sc._pick("Capital of France?", [(_entry("capital of france?"), 0.4)])
    assert exact.mode == "full" and exact.similarity == 1.0
    full = sc._pick("tell me about tcp", [(_entry("explain tcp to me"), 0.95)])
    assert full.mode == "full"
    hybrid = sc._pick("tell me about tcp", [(_entry("explain tcp to me"), 0.55)])
    assert hybrid.mode == "hybrid" and hybrid.novel == "tell me about tcp"
    miss = sc._pick("tell me about tcp", [(_entry("explain tcp to me"), 0.2)])
    assert miss.mode == "miss"
    unsafe = sc._pick("cost of 3 items", [(_entry("cost of 9 items"), 0.99)])
    assert unsafe.mode == "miss"  # different numbers must never replay


def test_build_hybrid_messages_injects_or_extends_system():
    match = sc.SemanticMatch(_entry("old q", "old a"), 0.7, "hybrid", "new part", 0.5)
    out = sc.build_hybrid_messages([{"role": "user", "content": "q"}], match)
    assert out[0]["role"] == "system" and "old a" in out[0]["content"]
    out2 = sc.build_hybrid_messages(
        [{"role": "system", "content": "base"}, {"role": "user", "content": "q"}], match
    )
    assert out2[0]["content"].startswith("base") and "new part" in out2[0]["content"]
    assert len(out2) == 2


def test_entry_from_payload_requires_prompt_and_answer():
    assert sc._entry_from_payload("1", {"prompt": "p"}) is None
    e = sc._entry_from_payload("1", {"prompt": "p", "answer": "a", "quality": "0.5"})
    assert e.id == "1" and e.quality == 0.5


class FakeQdrant:
    def __init__(self):
        self.points = []
        self.created = False

    def get_collections(self):
        return SimpleNamespace(collections=[])

    def create_collection(self, **kw):
        self.created = True

    def create_payload_index(self, **kw):
        raise RuntimeError("index already exists")

    def upsert(self, collection_name, wait, points):
        self.points.extend(points)

    def query_points(self, **kw):
        owner = kw["query_filter"].must[0].match.value
        pts = [
            SimpleNamespace(id=p.id, payload=p.payload, score=0.99)
            for p in self.points
            if p.payload["owner"] == owner
        ]
        return SimpleNamespace(points=pts)

    def delete(self, **kw):
        self.points.clear()


@pytest.fixture
def fake_qdrant(monkeypatch):
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "qdrant_url", "http://qdrant.test")
    monkeypatch.setattr(settings, "nvidia_api_key", "nv-test")
    fake = FakeQdrant()
    monkeypatch.setattr(sc, "_client", fake)
    monkeypatch.setattr(sc, "_ensured", False)

    async def fake_embed(text):
        return [1.0, 0.0]

    monkeypatch.setattr(sc, "embed_query", fake_embed)
    monkeypatch.setattr(sc, "get_embedding", lambda text: [1.0, 0.0])
    return fake


async def test_semantic_roundtrip_is_owner_scoped(fake_qdrant):
    assert sc.qdrant_configured()
    await sc.remember_semantic(
        prompt="what is a mutex", answer="a lock", model="m", tier="economy", quality=0.9, owner="a"
    )
    assert fake_qdrant.created and len(fake_qdrant.points) == 1
    hit = await sc.find_similar("what is a mutex", "a")
    assert hit.mode == "full" and hit.entry.answer == "a lock"
    assert await sc.find_similar("what is a mutex", "b") is None
    r = sc.retrieve_data("what is a mutex", "a")
    assert r["retrieved_answers"] == ["a lock"]
    await sc.delete_semantic_by_owner("a")
    assert fake_qdrant.points == []


async def test_semantic_disabled_or_unconfigured_is_noop(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "semantic_cache", "off")
    assert not sc.semantic_enabled()
    assert await sc.find_similar("x", "o") is None
    await sc.remember_semantic(prompt="x", answer="y", model="m", tier="t", quality=1, owner="o")


async def test_semantic_errors_are_swallowed(fake_qdrant, monkeypatch):
    def broken(**kw):
        raise RuntimeError("qdrant down")

    monkeypatch.setattr(fake_qdrant, "query_points", broken)
    assert await sc.find_similar("q", "a") is None
