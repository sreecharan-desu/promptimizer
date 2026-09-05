# Optimizer routing

Production gateway: Next.js [`apps/web/src/server/engine.ts`](../apps/web/src/server/engine.ts).

## Pipeline

1. Extract `RequestRequirements` from the OpenAI chat body (tools, vision, JSON mode, size).
2. Capability-filter models (structured rejection reasons).
3. If `model_quality_profiles` exist for the user → `quality_profile` policy: cheapest known-price model with quality ≥ `MIN_QUALITY`.
4. Else → `bootstrap_heuristic`: existing `p_small_quality` / tier pick.
5. Exact + prefix cache (Upstash/Redis).
6. Validate answer; escalate with `escalation_reason` when thin/refusal/JSON fail.
7. Persist `usage_events` + `routing_events` (no raw prompts).

## Offline vs live

- Offline: console **Benchmark** → deterministic `scoreAnswer` → aggregate `ModelQualityProfile` → Postgres.
- Live: profiles feed `chooseModel`; never run an LLM judge on every request.

## Deferred

LangGraph orchestration, external Ragas, LangSmith — see `references/llm-cost-optimizer/`. Live similarity cache uses NVIDIA `nemotron-3-embed-1b` (2048-d) via Qdrant when configured, else local hashed vectors in Redis/memory (`SEMANTIC_THRESHOLD`, default 0.5).
