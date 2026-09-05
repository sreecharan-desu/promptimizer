# API reference

Base URLs:

- FastAPI: `http://localhost:8000`
- Vercel / Next: `https://<app>/api`

All mutating console calls after connect send `X-Promptimizer-Session: sess_...` (also accepted as `Authorization: Bearer sess_...`).

## POST /v1/providers/connect

Start a session.

```json
{
  "mode": "byok",
  "provider": "groq",
  "api_key": "gsk_..."
}
```

```json
{
  "mode": "byok",
  "label": "Groq",
  "base_url": "https://api.groq.com/openai/v1",
  "api_key": "gsk_..."
}
```

Returns `session_id`, auto-tiered `models`, and `baseline_model`. The key is encrypted at rest in the session store and never echoed back.

## GET /v1/session

Public session + cumulative stats.

## DELETE /v1/session

Drop the session.

## GET /v1/models

OpenAI-shaped list with `tier`, `input_per_1m`, `output_per_1m`, `selected`.

## PATCH /v1/models

```json
{
  "overrides": { "llama-3.3-70b-versatile": "standard" },
  "selected": { "llama-3.1-8b-instant": true },
  "baseline_model": "llama-3.3-70b-versatile"
}
```

## POST /v1/classify

```json
{ "prompt": "Design a rate limiter for 1 million QPS" }
```

Returns `complexity`, `category`, `recommended_tier`, `quality_risk`, `rationale`, `features`.

## POST /v1/chat/completions

OpenAI Chat Completions body. `model` defaults to `"auto"`. Optional `level_override` (1–5).

Extra response fields:

```json
{
  "usage": {
    "cost": {
      "actual_usd": 0.00012,
      "baseline_usd": 0.0024,
      "saved_usd": 0.00228,
      "saved_pct": 95.0,
      "cache_discount_usd": 0.00001,
      "cached_tokens": 128
    }
  },
  "promptimizer": {
    "complexity": 5,
    "tier": "frontier",
    "cache_hit": false,
    "escalated": false,
    "quality_gate": "pass"
  }
}
```

## GET /v1/benchmark

Fixed 15-task spec with gold answers and `must_include` concepts.

## POST /v1/benchmark/run

Runs every task routed and (optionally) again on the baseline model. Summary includes `saved_pct`, `avg_quality_routed`, `avg_quality_frontier`, `quality_delta`.

## GET /v1/analytics

Session totals.

## GET /health

FastAPI liveness + cache stats.

## Errors

OpenAI-ish:

```json
{ "detail": "Provider rejected the key: ..." }
```

`401` missing/expired session, `400` bad body, provider status codes passed through on BYOK failures.
