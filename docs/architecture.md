# Architecture

Promptimizer is a middleware router, not a new model vendor.

1. **Connect** — BYOK against a catalog provider (app-owned base URL + user API key).
2. **Catalog** — `GET /models`, normalize into ModelProfile (pricing, context, features), tier `economy | standard | frontier`.
3. **Classify** — transparent features → complexity 1–5 and `P(quality|small)`.
4. **Requirements** — tools / vision / structured output / size derived from the chat body.
5. **Route** — if benchmark quality profiles exist: cheapest known-price model that clears capability + `MIN_QUALITY` (`quality_profile`). Else labeled `bootstrap_heuristic` (tier pick).
6. **Cache** — SHA-256 exact message+model pairs; conversation-scoped prompt keys; system/prefix remember for discount. Semantic similarity via Redis and optional Qdrant (NVIDIA 2048-d when configured).
7. **Guard** — quality gate (deterministic → optional self-consistency → judge); escalate through tiers; bill failed hops and gate samples; never cache failing answers.
8. **Score / ledger** — gold overlap on benchmarks; live `usage_events` + `routing_events` for savings; `cache_replay` labeled when infra replay costs $0.

**Production gateway:** Next.js `/api/v1` on Vercel ([`apps/web`](../apps/web)).  
**Self-host twin:** FastAPI ([`apps/api`](../apps/api)).  
**Optimizer domain:** [`apps/web/src/server/optimizer`](../apps/web/src/server/optimizer), [`docs/optimizer.md`](optimizer.md), [`STRUCTURE.md`](../STRUCTURE.md).
