# Promptimizer

[![CI](https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/promptimizer.svg?color=cb3837)](https://www.npmjs.com/package/promptimizer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OpenAI-compatible middleware that classifies each request, routes it to the cheapest adequate model, applies prompt caching, and reports **cost saved versus always-frontier** alongside **quality** — so cheaper never means silently worse.

**[Demo](https://www.promptimizer.site)** ·
**[Docs](https://www.promptimizer.site/docs)** ·
**[API](https://www.promptimizer.site/docs/api)** ·
**[Portal](https://www.promptimizer.site/portal)**

---

## Features

| | |
| --- | --- |
| **BYOK routing** | Paste a key for OpenAI, Groq, Baseten, OpenRouter, etc. Models are discovered and auto-tiered (economy / standard / frontier). |
| **Quality gate** | Deterministic checks → optional self-consistency → sampled LLM judge. Failures escalate; both hops are billed. |
| **Prompt cache** | Exact, prefix, and semantic hits. Paraphrases can replay when entities and negation agree; hybrid path reuses overlap and generates only the novel delta. |
| **Honest ledger** | Actual vs baseline cost, negative savings allowed, cache discounts by provider, escalation waste tracked. |
| **Eval metrics** | PGR / APGR / CPT and a cost–quality frontier in the console. |

---

## Quick start

```bash
npm install
npm run dev:web
# http://localhost:3000 — connect a provider key in /console
```

```bash
npm i -g promptimizer   # or: npx promptimizer
promptimizer login --key pmz_live_…
promptimizer connect baseten --key "$BASETEN_API_KEY"
promptimizer chat "What is 17 * 24?"
promptimizer savings
```

```ts
import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  apiKey: process.env.PROMPTIMIZER_API_KEY!,
});
```

---

## Architecture

<img src="https://github.com/user-attachments/assets/92875e10-d9ad-46db-86de-1168547ac2cf" alt="Promptimizer architecture" width="100%" />

Request path: **classify → pick tier → cache lookup → complete → quality gate → escalate if needed → ledger**.

| Policy | Behavior |
| --- | --- |
| `quality_profile` | Cheapest known-price model that clears capability + `MIN_QUALITY` (after benchmark profiles exist). |
| `bootstrap_heuristic` | Tier / `p_small_quality` picker until profiles exist. |

Every response is labeled with which policy ran.

---

## Repository

```text
apps/web          Next.js console, portal, auth, production /api/v1
apps/api          FastAPI gateway (optional self-host)
apps/docs         Mintlify docs source
packages/sdk      npm package: promptimizer
packages/cli      CLI binary
docs/             Internal notes
references/       Optimizer research reference (not runtime)
```

| Concern | Location |
| --- | --- |
| Routing engine | [`apps/web/src/server/engine.ts`](apps/web/src/server/engine.ts) |
| Optimizer core | [`apps/web/src/server/optimizer/`](apps/web/src/server/optimizer/) |
| Semantic cache | [`apps/web/src/server/semantic-cache.ts`](apps/web/src/server/semantic-cache.ts) |
| Quality gate | [`apps/web/src/server/quality.ts`](apps/web/src/server/quality.ts) |
| Routing metrics | [`apps/web/src/server/routing-metrics.ts`](apps/web/src/server/routing-metrics.ts) |

**Stack:** Next.js 15 · Node 22 · FastAPI / Python 3.12 (optional self-host twin) · Upstash Redis · Postgres · Docker Compose / Vercel

**Demo engine:** Production on Vercel runs the Next.js `/api/v1` router. FastAPI is an optional Compose twin with critical parity (routing, cache, savings, stream) — not a second full product.

### Judge demo (90 seconds)

1. Sign in → Connect a provider key in `/console`
2. Easy prompt (`What is 17 * 24?`) → economy tier, quality pass
3. Hard prompt (system design / multi-constraint) → escalate toward frontier; both hops billed
4. Paraphrase the easy ask → semantic / cache replay labeled `cache_replay`
5. Open Savings → actual vs always-frontier ledger

---

## Development

```bash
# Web
npm install && npm run dev:web

# Optional FastAPI twin
cd apps/api && python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000

# Full stack
docker compose up --build
```

Set `PROMPTIMIZER_API_URL=http://localhost:8000` on the web process to proxy into FastAPI.

**Auth env:** `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_MAIL_USER`, `GOOGLE_MAIL_PASSWORD`

### Tests

| Workflow | Runs |
| --- | --- |
| [CI](.github/workflows/ci.yml) | API pytest + ruff · SDK tests · web typecheck + build |
| [Publish](.github/workflows/publish.yml) | npm release on `main` |

```bash
cd apps/api && .venv/bin/pytest -q
npm test --workspace=promptimizer
npm test --workspace=@promptimizer/web
```

---

## Documentation

- Product docs: [www.promptimizer.site/docs](https://www.promptimizer.site/docs)
- API reference: [/docs/api](https://www.promptimizer.site/docs/api)
- SDK: [/docs/sdk](https://www.promptimizer.site/docs/sdk)
- Local OpenAPI: `http://localhost:8000/docs`
- Mintlify: `cd apps/docs && npx mintlify dev`

---

## License

[MIT](LICENSE)
