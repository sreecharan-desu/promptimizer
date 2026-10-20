"""http-level tests for the fastapi gateway with a fake openai-compatible upstream."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.api import routes
from app.core import rate_limit
from app.main import app
from app.providers import openai_compat
from app.providers.openai_compat import ProviderError

MODELS = [
    {"id": "promptimizer-nano", "owned_by": "t"},
    {"id": "promptimizer-flash", "owned_by": "t"},
    {"id": "promptimizer-frontier", "owned_by": "t"},
]

GOOD = (
    "Paris is the capital of France. It has been the political centre of the country "
    "for centuries and hosts the national government."
)


class FakeUpstream:
    def __init__(self, answers: dict[str, str] | None = None) -> None:
        self.calls: list[dict] = []
        self.answers = answers or {}

    async def chat(self, *, base_url: str, api_key: str, body: dict) -> dict:
        self.calls.append({"base_url": base_url, "api_key": api_key, "body": body})
        text = self.answers.get(body["model"], GOOD)
        return {
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "created": 1,
            "model": body["model"],
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 30},
        }


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    rate_limit._memory.clear()
    yield
    rate_limit._memory.clear()


@pytest.fixture
def upstream(monkeypatch):
    fake = FakeUpstream()

    async def fake_list(base_url, api_key):
        if api_key == "bad":
            raise ProviderError(401, "invalid key")
        if api_key == "empty":
            return []
        return MODELS

    monkeypatch.setattr(routes, "list_models", fake_list)
    monkeypatch.setattr(openai_compat, "chat_completions", fake.chat)
    return fake


@pytest.fixture
def client():
    return TestClient(app)


def _connect(client, key="sk-test"):
    r = client.post(
        "/v1/providers/connect",
        json={"provider": "openai", "api_key": key, "label": "test"},
    )
    assert r.status_code == 200, r.text
    return r.json()["session_id"]


def test_root_and_health(client):
    assert client.get("/").json()["health"] == "/health"
    body = client.get("/health").json()
    assert body["ok"] is True
    assert "hit_rate" in body["cache"]


def test_providers_catalog(client):
    data = client.get("/v1/providers").json()["data"]
    ids = {p["id"] for p in data}
    assert {"openai", "groq", "openrouter"} <= ids


@pytest.mark.parametrize(
    "payload,status,needle",
    [
        ({"mode": "mock", "api_key": "x"}, 400, "Simulator"),
        ({"provider": "nope", "api_key": "x"}, 400, "Unknown provider"),
        ({"provider": "openai", "api_key": "  "}, 400, "api_key is required"),
        ({"provider": "openai", "api_key": "bad"}, 401, "rejected"),
    ],
)
def test_connect_validation(client, upstream, payload, status, needle):
    r = client.post("/v1/providers/connect", json=payload)
    assert r.status_code == status
    assert needle in r.json()["detail"]


def test_connect_empty_model_list_falls_back_to_default(client, upstream):
    sid = _connect(client, key="empty")
    models = client.get("/v1/models", headers={"X-Promptimizer-Session": sid}).json()
    assert [m["id"] for m in models["data"]] == ["default"]


def test_session_lifecycle_and_auth(client, upstream):
    assert client.get("/v1/session").status_code == 401
    assert (
        client.get("/v1/session", headers={"X-Promptimizer-Session": "sess_x"}).status_code == 401
    )
    sid = _connect(client)
    # bearer form works too
    r = client.get("/v1/session", headers={"Authorization": f"Bearer {sid}"})
    assert r.status_code == 200
    s = r.json()
    assert s["label"] == "test"
    assert "sk-test" not in json.dumps(s)  # key never echoed
    assert s["baseline_model"] == "promptimizer-frontier"
    assert client.delete("/v1/session", headers={"X-Promptimizer-Session": sid}).json() == {
        "ok": True
    }
    assert client.get("/v1/session", headers={"X-Promptimizer-Session": sid}).status_code == 401


def test_patch_models_overrides_and_selection(client, upstream):
    sid = _connect(client)
    h = {"X-Promptimizer-Session": sid}
    r = client.patch(
        "/v1/models",
        headers=h,
        json={
            "overrides": {"promptimizer-flash": "frontier"},
            "selected": {"promptimizer-nano": False},
            "baseline_model": "promptimizer-flash",
        },
    )
    assert r.status_code == 200
    by_id = {m["id"]: m for m in r.json()["models"]}
    assert by_id["promptimizer-flash"]["tier"] == "frontier"
    assert by_id["promptimizer-nano"]["selected"] is False
    assert client.get("/v1/models", headers=h).json()["baseline_model"] == "promptimizer-flash"


def test_classify_endpoint(client):
    assert client.post("/v1/classify", json={}).status_code == 400
    easy = client.post("/v1/classify", json={"prompt": "What is 2+2?"}).json()
    hard = client.post(
        "/v1/classify",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "Design a distributed rate limiter across 50 regions and "
                    "prove its consistency guarantees under partitions.",
                }
            ]
        },
    ).json()
    assert easy["complexity"] < hard["complexity"]


def test_chat_routes_cheap_and_replays_exact_cache(client, upstream):
    sid = _connect(client)
    h = {"X-Promptimizer-Session": sid}
    body = {"messages": [{"role": "user", "content": "What is the capital of France?"}]}
    first = client.post("/v1/chat/completions", headers=h, json=body).json()
    meta = first["promptimizer"]
    assert meta["tier"] == "economy"
    assert meta["exact_cache_hit"] is False
    assert first["usage"]["cost"]["saved_usd"] >= 0
    assert len(upstream.calls) == 1
    assert upstream.calls[0]["api_key"] == "sk-test"  # decrypted key reaches upstream

    second = client.post("/v1/chat/completions", headers=h, json=body).json()
    assert second["promptimizer"]["exact_cache_hit"] is True
    assert len(upstream.calls) == 1  # no second upstream call

    stats = client.get("/v1/analytics", headers=h).json()
    assert stats["session"]["stats"]["requests"] == 2
    assert client.get("/v1/savings", headers=h).json()["saved_pct"] == stats["saved_pct"]


def test_chat_passes_extra_params_and_model_hint(client, upstream):
    sid = _connect(client)
    r = client.post(
        "/v1/chat/completions",
        headers={"X-Promptimizer-Session": sid},
        json={
            "messages": [{"role": "user", "content": "hi there, explain tcp briefly"}],
            "model": "promptimizer-flash",
            "temperature": 0.2,
            "max_tokens": 50,
        },
    )
    assert r.status_code == 200
    sent = upstream.calls[-1]["body"]
    assert sent["model"] == "promptimizer-flash"
    assert sent["temperature"] == 0.2 and sent["max_tokens"] == 50


def test_chat_escalates_when_cheap_answer_is_degraded(client, upstream):
    upstream.answers["promptimizer-nano"] = "I'm sorry, I can't help with that."
    sid = _connect(client)
    r = client.post(
        "/v1/chat/completions",
        headers={"X-Promptimizer-Session": sid},
        json={"messages": [{"role": "user", "content": "What is the capital of France?"}]},
    ).json()
    meta = r["promptimizer"]
    assert meta["initial_model"] == "promptimizer-nano"
    assert meta["escalated"] is True
    assert meta["final_model"] != "promptimizer-nano"
    assert len(upstream.calls) >= 2


def test_chat_upstream_error_is_surfaced(client, upstream, monkeypatch):
    async def boom(**_):
        raise ProviderError(503, "upstream down")

    monkeypatch.setattr(openai_compat, "chat_completions", boom)
    sid = _connect(client)
    r = client.post(
        "/v1/chat/completions",
        headers={"X-Promptimizer-Session": sid},
        json={"messages": [{"role": "user", "content": "unique prompt for error path"}]},
    )
    assert r.status_code == 503
    assert r.json()["detail"] == "upstream down"


def test_chat_with_no_selected_models_is_400(client, upstream):
    sid = _connect(client)
    h = {"X-Promptimizer-Session": sid}
    client.patch("/v1/models", headers=h, json={"selected": {m["id"]: False for m in MODELS}})
    r = client.post(
        "/v1/chat/completions",
        headers=h,
        json={"messages": [{"role": "user", "content": "anything"}]},
    )
    assert r.status_code == 400


def test_chat_streaming_sse(client, upstream):
    sid = _connect(client)
    with client.stream(
        "POST",
        "/v1/chat/completions",
        headers={"X-Promptimizer-Session": sid},
        json={
            "messages": [{"role": "user", "content": "stream: capital of France?"}],
            "stream": True,
        },
    ) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        lines = [ln for ln in r.iter_lines() if ln.startswith("data: ")]
    assert lines[-1] == "data: [DONE]"
    chunks = [json.loads(ln[6:]) for ln in lines[:-1]]
    text = "".join(c["choices"][0]["delta"].get("content", "") for c in chunks)
    assert text == GOOD
    assert chunks[-1]["choices"][0]["finish_reason"] == "stop"
    assert chunks[-1]["promptimizer"]["model"]


def test_chat_quality_profile_routing(client, upstream):
    sid = _connect(client)
    r = client.post(
        "/v1/chat/completions",
        headers={"X-Promptimizer-Session": sid},
        json={
            "messages": [{"role": "user", "content": "quality profile route test"}],
            "quality_profiles": {
                "promptimizer-nano": {"overall_quality": 0.5},
                "promptimizer-flash": {"overall_quality": 0.9},
                "promptimizer-frontier": {"overall_quality": 0.95},
            },
        },
    ).json()
    assert r["promptimizer"]["routing_policy"] in {"quality_profile", "bootstrap_heuristic"}
    assert r["promptimizer"]["model"] != "promptimizer-nano" or r["promptimizer"]["escalated"]


def test_benchmark_spec_and_run(client, upstream):
    spec = client.get("/v1/benchmark").json()
    assert spec["tasks"]
    sid = _connect(client)
    out = client.post(
        "/v1/benchmark/run",
        headers={"X-Promptimizer-Session": sid},
        json={"compare_always_frontier": True},
    ).json()
    assert out["tasks"] == len(spec["tasks"])
    assert len(out["rows"]) == len(spec["tasks"])
    s = out["summary"]
    assert 0 <= s["avg_quality_routed"] <= 1
    assert s["baseline_usd"] >= s["actual_usd"] - 1e-9 or s["saved_usd"] < 0


def test_rate_limit_connect_returns_429(client, upstream):
    codes = [
        client.post("/v1/providers/connect", json={"provider": "nope", "api_key": "x"}).status_code
        for _ in range(31)
    ]
    assert codes[:30] == [400] * 30
    assert codes[30] == 429
