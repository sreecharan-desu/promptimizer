# Repository structure

Production layout for Promptimizer. Runtime code lives under `apps/` and `packages/`. Reference material under `references/` is **not** imported by the app.

```
hackathon/
├── apps/
│   ├── web/                 # Next.js 15 — marketing, auth, console, portal, production /api/v1
│   │   └── src/
│   │       ├── app/         # App Router pages + route handlers
│   │       ├── components/  # UI
│   │       ├── lib/         # Client helpers
│   │       └── server/      # Auth, DB, engine, optimizer domain
│   │           └── optimizer/   # Quality-aware routing core (TS)
│   ├── api/                 # FastAPI twin (Compose / self-host)
│   │   └── app/
│   │       ├── api/         # HTTP routes
│   │       ├── core/        # Config, sessions
│   │       ├── domain/      # Classifier, router, cache, optimizer/
│   │       └── providers/   # OpenAI-compatible clients
│   └── docs/                # Mintlify source (mirrors site /docs)
├── packages/
│   ├── sdk/                 # npm `promptimizer` — classify + client
│   └── cli/                 # `promptimizer` binary
├── docs/                    # Internal engineering notes
├── references/
│   └── llm-cost-optimizer/  # Attached ZIP + notebook (reference only)
├── scripts/                 # Publish / ops scripts
├── docker-compose.yml
├── vercel.json
└── .env.example
```

## Source of truth

| Concern | Location |
| --- | --- |
| Production gateway | `apps/web` (`/api/v1`) |
| Auth / Postgres | `apps/web/src/server/{account,db,crypto}.ts` |
| Live routing | `apps/web/src/server/engine.ts` + `optimizer/` |
| Self-host twin | `apps/api` |
| Customer-facing docs | `apps/web` `/docs` + `apps/docs` |

Do not run `references/llm-cost-optimizer` as a second product.
