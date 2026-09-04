# Architecture

Promptimizer is a middleware router, not a new model vendor.

1. **Connect** — mock fleet, or BYOK against a catalog provider (app-owned base URL + user API key).
2. **Catalog** — `GET /models`, normalize into ModelProfile (pricing, context, features), tier `economy | standard | frontier`.
3. **Classify** — transparent features → complexity 1–5 and `P(quality|small)`.
4. **Requirements** — tools / vision / structured output / size derived from the chat body.
5. **Route** — if benchmark quality profiles exist: cheapest known-price model that clears capability + `MIN_QUALITY` (`quality_profile`). Else labeled `bootstrap_heuristic` (tier pick).
6. **Cache** — SHA-256 exact message+model pairs; system/prefix remember for discount. Upstash/Redis — not Qdrant on the hot path.
7. **Guard** — thin, refusing, or failed structured answers escalate; `escalation_reason` recorded.
8. **Score / ledger** — gold overlap on benchmarks; live `usage_events` + `routing_events` for savings.

**Production gateway:** Next.js `/api/v1` on Vercel ([`apps/web`](../apps/web)).  
**Self-host twin:** FastAPI ([`apps/api`](../apps/api)).  
**Optimizer domain:** [`apps/web/src/server/optimizer`](../apps/web/src/server/optimizer), [`docs/optimizer.md`](optimizer.md), [`STRUCTURE.md`](../STRUCTURE.md).
