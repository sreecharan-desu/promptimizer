# Frontend

`apps/web` is a Next.js 15 App Router site.

## Routes

| Path | Job |
| --- | --- |
| `/` | Marketing home — classifier mock, code panel, quality table |
| `/console` | BYOK + simulator, fleet table, playground, benchmark |
| `/docs` | Routing / quality / stack |
| `/docs/api` | Endpoint list |
| `/docs/sdk` | npm package |
| `/privacy`, `/terms` | Legal prose |

## UI system

x-ai skill chrome: 64px header, jet canvas, fog body, pill CTAs, medium display type. **Gold accent** (`hsl(40 72% 62%)`) for savings, badges, and the highlighted chart bar. Empty console state uses an editorial still-life (key card, terminal, cup).

## Data

The browser talks only to same-origin `/api/v1`. That either runs the TypeScript engine or proxies to `PROMPTIMIZER_API_URL`. Session id is the only secret in `localStorage`.

## Verify

```bash
pnpm --filter @promptimizer/web dev
```

1. Home loads, theme toggle in the footer cycles dark → light → system.
2. Console → Simulator → fleet shows nano / flash / frontier.
3. Playground: “capital of France” → economy. Rate-limiter prompt → frontier.
4. Benchmark: savings high, quality delta near zero.
