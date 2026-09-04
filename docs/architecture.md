# Architecture

Promptimizer is a middleware router, not a new model vendor.

1. **Connect** — mock fleet, or BYOK against any OpenAI-compatible `base_url`.
2. **Catalog** — `GET /models`, drop embeddings/audio/image, attach prices, infer `economy | standard | frontier`.
3. **Classify** — transparent features (length, code, math, design, safety). Complexity 1–5. High-risk categories cannot use economy.
4. **Route** — cheapest selected model in the adequate tier, then step up if empty.
5. **Cache** — SHA-256 of system + long context prefixes. Repeat prefixes get a 50% input discount. Exact message+model pairs return the stored completion.
6. **Guard** — thin or refusing answers on hard tasks escalate one tier.
7. **Score** — gold overlap + required concepts + structure, compared to always-frontier.

The FastAPI service is the production-shaped implementation (Redis, encrypted sessions, Compose). The Next.js `/api/v1` engine is the same contract so Vercel can host a complete demo without a second process.
