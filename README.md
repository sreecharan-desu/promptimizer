# Promptimizer

<p align="center">
  <strong>Quality-aware LLM routing for any OpenAI-compatible key.</strong>
  <br />
  Classify → route → cache → gate → escalate — then report <em>cost saved</em> next to <em>quality held</em>.
</p>

<p align="center">
  <a href="https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml"><img src="https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/sreecharan-desu/promptimizer/actions/workflows/publish.yml"><img src="https://github.com/sreecharan-desu/promptimizer/actions/workflows/publish.yml/badge.svg" alt="Publish" /></a>
  <a href="https://hackathon-omega-liart.vercel.app"><img src="https://img.shields.io/badge/demo-live-success?logo=vercel" alt="Live demo" /></a>
  <a href="https://www.npmjs.com/package/promptimizer"><img src="https://img.shields.io/npm/v/promptimizer.svg?logo=npm" alt="npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="MIT" /></a>
  <img src="https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white" alt="Node 22" />
  <img src="https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" />
</p>

<p align="center">
  <a href="https://hackathon-omega-liart.vercel.app">Live app</a> ·
  <a href="https://hackathon-omega-liart.vercel.app/docs">Docs</a> ·
  <a href="https://hackathon-omega-liart.vercel.app/docs/api">API</a> ·
  <a href="https://hackathon-omega-liart.vercel.app/portal">Savings portal</a> ·
  <a href="#run-locally">Run locally</a>
</p>

---

## What it does

Promptimizer sits in front of your models like middleware. For every request it:

1. **Classifies** difficulty, task type, and how likely a small model is to succeed  
2. **Routes** to the cheapest adequate tier — economy / standard / frontier  
3. **Caches** exact prompts, prefix blocks, and similar paraphrases (with entity / negation guards)  
4. **Gates** the answer and escalates when quality fails — billing both hops honestly  
5. **Reports** savings versus always-frontier **next to** quality, so cheap-and-wrong is visible  

**BYOK.** Paste a key for OpenAI, Groq, Baseten, OpenRouter, and more — we already know the base URL. We fetch `/v1/models`, auto-tier, and route. Savings show in `/portal` and `promptimizer savings`.

> Anyone can make AI cheaper by making it worse. We measure both sides.

---

## Architecture

<p align="center">
  <img src="https://github.com/user-attachments/assets/92875e10-d9ad-46db-86de-1168547ac2cf" alt="Promptimizer architecture — clients, auth, gateway, BYOK fleet" width="100%" />
</p>

**Flow:** sign in → connect provider (key only) → discover / normalize models → optional benchmark → chat with cache + escalate → savings portal / CLI.

---

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Gateway | FastAPI / Python 3.12 | OpenAPI, Redis, self-host |
| Console + marketing | Next.js 15 on Vercel | Accounts, keys, production `/api/v1` |
| SDK | TypeScript · `npm i promptimizer` | Drop-in client + offline classifier |
| Cache | Upstash Redis or in-memory | Exact, prefix, and semantic hits |
| Deploy | Docker Compose + Vercel | Local parity, one-click web |

Theme: jet chrome with a **gold** accent — savings you can see, not another purple AI gradient.

---

## Monorepo

```text
apps/api          FastAPI gateway, classifier, cache, benchmark
apps/web          Next.js marketing + console + auth + /api/v1
apps/docs         Mintlify source (same IA as /docs)
packages/sdk      promptimizer npm package
packages/cli      promptimizer binary (login, connect, chat, savings)
docs/             Internal notes
references/       Optimizer reference (not runtime)
scripts/          Publish helpers
STRUCTURE.md      Full directory map
```

### Optimizer core

| Concept | Where |
| --- | --- |
| ModelProfile, capability filter, quality-aware choose | [`apps/web/src/server/optimizer/`](apps/web/src/server/optimizer/) |
| Live `routeChat` + bootstrap fallback | [`apps/web/src/server/engine.ts`](apps/web/src/server/engine.ts) |
| Quality profiles + routing events | [`apps/web/src/server/db.ts`](apps/web/src/server/db.ts) |
| FastAPI twin | [`apps/api/app/domain/optimizer/`](apps/api/app/domain/optimizer/) |

**Routing policy**

1. `quality_profile` — cheapest known-price model that clears capability + `MIN_QUALITY`  
2. `bootstrap_heuristic` — tier / `p_small_quality` until profiles exist  

Meta always labels which policy ran.

---

## Run locally

```bash
npm install
npm run dev:web
# → http://localhost:3000  (simulator works with no vendor key)
```

Optional FastAPI gateway:

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
docker compose up --build
```

Set `PROMPTIMIZER_API_URL=http://localhost:8000` on the web process to proxy into FastAPI instead of the serverless engine.

---

## CLI & SDK

```bash
npm run promptimizer -- login --key pmz_live_…
npm run promptimizer -- connect baseten --key "$BASETEN_API_KEY"
npm run promptimizer -- chat "What is 17 * 24?"
npm run promptimizer -- savings
```

```ts
import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});
```

**Accounts:** set `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_MAIL_USER`, and `GOOGLE_MAIL_PASSWORD`. Sign up at `/signup`, create a `pmz_live_` key at `/account`, then connect a provider.

---

## Tests & CI

| Workflow | What it runs |
| --- | --- |
| [CI](https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml) | API pytest + ruff · SDK tests · web typecheck + build |
| [Publish](https://github.com/sreecharan-desu/promptimizer/actions/workflows/publish.yml) | npm package release on `main` |

```bash
cd apps/api && .venv/bin/pytest -q
npm test --workspace=promptimizer
npm test --workspace=@promptimizer/web   # quality / cache / cost unit tests
```

---

## Docs

| | |
| --- | --- |
| Product docs | [hackathon-omega-liart.vercel.app/docs](https://hackathon-omega-liart.vercel.app/docs) |
| API reference | [docs/api](https://hackathon-omega-liart.vercel.app/docs/api) |
| SDK | [docs/sdk](https://hackathon-omega-liart.vercel.app/docs/sdk) |
| FastAPI OpenAPI | `http://localhost:8000/docs` |
| Mintlify preview | `cd apps/docs && npx mintlify dev` |

---

## License

[MIT](LICENSE)
