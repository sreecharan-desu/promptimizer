# promptimizer

[![ci](https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/sreecharan-desu/promptimizer/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/promptimizer.svg?color=cb3837)](https://www.npmjs.com/package/promptimizer)
[![license: mit](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

openai-compatible middleware that classifies each request, routes it to the cheapest adequate model, applies prompt caching, and reports cost saved against always-frontier next to quality.

[demo](https://www.promptimizer.site) · [docs](https://docs.promptimizer.site/docs) · [api](https://docs.promptimizer.site/docs/api) · [portal](https://www.promptimizer.site/portal)

## features

- byok routing: paste a key for openai, groq, baseten, openrouter and others. models are discovered and tiered (economy / standard / frontier).
- quality gate: deterministic checks, optional self-consistency, sampled llm judge. failures escalate and both hops are billed.
- prompt cache: exact, prefix and semantic hits. paraphrases replay only when entities and negation agree.
- ledger: actual vs baseline cost, negative savings allowed, provider cache discounts, escalation waste tracked.
- eval metrics: pgr / apgr / cpt and a cost-quality frontier in the console.

request path: classify → pick tier → cache lookup → complete → quality gate → escalate if needed → ledger. every response is labeled with the policy that ran (`quality_profile` or `bootstrap_heuristic`).

## stack

next.js 15 · node 22 · fastapi / python 3.12 (optional self-host twin) · upstash redis · postgres · docker compose / vercel

```text
apps/web          next.js console, portal, auth, production /api/v1
apps/api          fastapi gateway (optional self-host)
apps/docs         mintlify docs source
packages/sdk      npm package: promptimizer
packages/cli      cli binary
references/       optimizer research reference (not runtime)
```

## run locally

needs node 22.6+ (see `.nvmrc`).

```bash
npm install
npm run dev:web          # http://localhost:3000, connect a provider key in /console
```

optional fastapi twin and full stack:

```bash
cd apps/api && python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000
docker compose up --build
```

set `PROMPTIMIZER_API_URL=http://localhost:8000` on the web process to proxy into fastapi.

cli and sdk:

```bash
npx promptimizer login --key pmz_live_…
npx promptimizer chat "What is 17 * 24?"
```

tests:

```bash
cd apps/api && .venv/bin/pytest -q
npm test --workspace=promptimizer
npm test --workspace=@promptimizer/web
```

## env

copy `.env.example` to `.env`. auth needs `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_MAIL_USER`, `GOOGLE_MAIL_PASSWORD`.

## performance (measured)

measured on a single machine (8 vCPU Intel Xeon, 16 GB RAM, Linux), with k6 running on the same box against the FastAPI gateway (`apps/api`, 4 uvicorn workers, in-memory cache). these requests never call an upstream LLM, so they measure router overhead only, not end-to-end chat latency. raw output: [`benchmarks/results-2026-10-19/`](benchmarks/results-2026-10-19/), environment in [`environment.txt`](benchmarks/results-2026-10-19/environment.txt), reproduce with [`benchmarks/run.sh`](benchmarks/run.sh).

| endpoint | concurrent VUs | req/s | p50 | p95 | p99 | errors |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /v1/classify` | 50 | 19,727 | 2.32 ms | 4.73 ms | 6.42 ms | 0% |
| `POST /v1/classify` | 200 | 20,434 | 8.84 ms | 17.12 ms | 24.66 ms | 0% |
| `GET /health` | 50 | 38,383 | 1.11 ms | 2.56 ms | 3.81 ms | 0% |

tests on the same run: API pytest 16 passed (43% line coverage, [`pytest-coverage.txt`](benchmarks/results-2026-10-19/pytest-coverage.txt)); SDK 11/11 and web 38/38 `node --test` cases passed; web typecheck and `next build` passed.

## known issues

- js tests use `node --experimental-strip-types`, which needs node 22.6+. on node 20 they exit with code 9.
- `npm audit` reports 10 high and 6 moderate advisories in the js workspace (19 oct 2026).
- api line coverage is 43%. `router.py`, `semantic_cache.py` and the provider client are mostly untested.
- cost-saved and quality figures depend on your provider and prompts. no fixed savings percentage is claimed.

## license

[mit](LICENSE)

---

built by [sreecharan desu](https://www.sreecharandesu.in) · [more projects](https://www.sreecharandesu.in/work)
