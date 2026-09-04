# Promptimizer

Quality-aware LLM routing for any OpenAI-compatible key.

Promptimizer sits in front of a cheap model and a frontier model (real providers or the built-in simulator). It classifies each request, extracts capability requirements, filters incompatible models, and — when benchmark-derived **ModelQualityProfile** data exists — picks the **cheapest model that clears the quality threshold**. Otherwise it uses a labeled **bootstrap heuristic** (tier by `P(quality|small)`). It caches repeated system/context prefixes and reports **cost saved versus always-frontier** on a fixed benchmark — together with a **quality score**, so savings that come from silently worse answers are visible.

**BYOK.** Paste a key for a known host (OpenAI, Groq, Baseten, OpenRouter, …). We already have the base URL. Custom is the only case that asks for one. We fetch `/v1/models`, auto-tier them, and route. Savings land on `/portal` and in the CLI.

## Why this stack

| Piece | Choice | Why |
| --- | --- | --- |
| Gateway | FastAPI / Python 3.12 | OpenAPI, Redis, self-host |
| Console + marketing | Next.js 15 on Vercel | Accounts, API keys, and the production `/api/v1` |
| SDK | TypeScript, `npm i promptimizer` | Dynaroute-style drop-in + offline classifier |
| Cache | In-memory or Redis | Prompt-prefix hits in Compose; memory for the simulator |
| Deploy | Docker Compose + Vercel | Production-shaped local, one-click web |

Theme is jet chrome with a **gold** accent — savings you can see, not another purple AI gradient.

## Architecture

```mermaid
flowchart TB
  subgraph clients [Clients]
    WebUI[Web console and portal]
    CLI[promptimizer CLI REPL]
    SDK[promptimizer SDK]
    OAI[OpenAI-compatible SDK]
  end

  subgraph auth [Auth and tenancy]
    Signup[Sign up / verify email]
    Login[Login / Google OAuth]
    Cookie[pmz_session cookie]
    Keys[pmz_live_ API keys]
    PG[(Postgres users sessions keys providers)]
  end

  subgraph gateway [Gateway apps_web /api/v1]
    Connect[POST providers/connect]
    Discover[GET models normalize ModelProfile]
    Classify[Classify L1-L5 p_small_quality]
    Reqs[Extract RequestRequirements]
    Cap[Capability filter]
    Policy{Quality profiles?}
    QP[quality_profile cheapest eligible]
    Boot[bootstrap_heuristic tier pick]
    Cache[Upstash exact and prefix cache]
    Invoke[Provider chat completions]
    Guard[Validate escalate]
    Ledger[usage_events routing_events]
    Bench[POST benchmark/run]
    Profiles[model_quality_profiles]
    Savings[GET savings]
  end

  subgraph fleet [BYOK providers]
    Catalog[App-owned provider catalog]
    Eco[Economy]
    Std[Standard]
    Fr[Frontier baseline]
  end

  WebUI --> Signup --> PG
  WebUI --> Login --> Cookie --> PG
  WebUI --> Keys --> PG
  CLI -->|login logout /logout| Keys
  CLI --> gateway
  SDK --> gateway
  OAI --> gateway
  Cookie --> gateway
  Keys --> gateway

  Connect --> Catalog
  Connect --> Discover
  Discover --> PG

  gateway --> Classify --> Reqs --> Cap --> Policy
  Policy -->|yes| QP
  Policy -->|no| Boot
  QP --> Cache
  Boot --> Cache
  Cache -->|miss| Invoke
  Cache -->|hit| Ledger
  Invoke --> Eco
  Invoke --> Std
  Invoke --> Fr
  Eco --> Guard
  Std --> Guard
  Guard -->|degraded| Fr
  Guard --> Ledger
  Ledger --> Savings
  Ledger --> WebUI

  Bench --> Invoke
  Bench --> Profiles
  Profiles --> Policy
```

End-to-end product flow: **sign in → connect provider (key only) → discover/normalize models → optional benchmark (quality profiles) → chat/completions with cache + escalate → savings portal / CLI `/savings`**. CLI `/logout` clears `~/.promptimizer/config.json` (requires CLI ≥ 0.1.22).

## Optimizer core integration

Domain logic from the LLM Cost Optimizer reference (`references/llm-cost-optimizer/`) was adapted into the existing app — not copied as a second product:

| Concept | Where it lives |
| --- | --- |
| ModelProfile, pricing, requirements, capability filter, quality-aware choose | [`apps/web/src/server/optimizer/`](apps/web/src/server/optimizer/) |
| Live `routeChat` + bootstrap fallback | [`apps/web/src/server/engine.ts`](apps/web/src/server/engine.ts) |
| Quality profiles + routing events (Postgres) | [`apps/web/src/server/db.ts`](apps/web/src/server/db.ts) schema_v4 |
| FastAPI twin schemas/router helpers | [`apps/api/app/domain/optimizer/`](apps/api/app/domain/optimizer/) |

**Routing policy**

1. `quality_profile` — after a benchmark run persists per-model scores, live chat selects the cheapest known-price model that passes capability + `MIN_QUALITY`.
2. `bootstrap_heuristic` — until profiles exist (or no eligible candidate), use the existing tier/`p_small_quality` picker. Meta always labels which policy ran.

**Deferred (optional later):** LangGraph, LangChain wrappers, external Qdrant/OpenAI embeddings (local hashed vectors power similarity cache today), Ragas, LangSmith. Exact/prefix/semantic cache remains Upstash/Redis (or in-memory fallback).

## Monorepo

```
apps/api          FastAPI gateway, classifier, cache, benchmark, optimizer twin
apps/web          Next.js marketing + console + auth + production /api/v1
apps/docs         Mintlify source (same IA as /docs)
packages/sdk      promptimizer npm package
packages/cli      promptimizer binary (login, connect, chat, savings)
docs/             Internal notes (architecture, API, SDK, optimizer)
references/       Optimizer ZIP + notebook (reference only — not runtime)
scripts/          Publish helpers
STRUCTURE.md      Full directory map
```

## Run locally

```bash
# JS workspace (npm or pnpm)
npm install
npm run dev:web
# or: pnpm install && pnpm --filter @promptimizer/web dev

# Python gateway (optional — the web app already serves /api/v1)
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:3000](http://localhost:3000). Start the **simulator** — no vendor key required.

```bash
docker compose up --build
```

Set `PROMPTIMIZER_API_URL=http://localhost:8000` on the web process if you want Next.js to proxy into FastAPI instead of the serverless engine.

## Tests

```bash
cd apps/api && .venv/bin/pytest -q
pnpm --filter promptimizer test
```

## Accounts

Set `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_MAIL_USER`, and `GOOGLE_MAIL_PASSWORD`. Sign up at `/signup`, confirm the email we send, create a `pmz_live_` key at `/account`, then connect a provider in the console or:

```bash
npm run promptimizer -- login --key pmz_live_…
npm run promptimizer -- connect baseten --key "$BASETEN_API_KEY"
npm run promptimizer -- chat "What is 17 * 24?"
npm run promptimizer -- savings
```

Or from the SDK:

```ts
import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});
```

## Docs

Product docs live at `/docs` on the Next.js site (Mintlify-style sidebar, search, API pages). The same pages are Mintlify MDX in `apps/docs`.

```bash
# Site
npm run dev:web
# open http://localhost:3000/docs

# Official Mintlify preview
cd apps/docs && npx mintlify dev
```

- [Introduction](https://hackathon-omega-liart.vercel.app/docs)
- [API reference](https://hackathon-omega-liart.vercel.app/docs/api)
- [SDK](https://hackathon-omega-liart.vercel.app/docs/sdk)
- FastAPI OpenAPI: `http://localhost:8000/docs`

## License

MIT
