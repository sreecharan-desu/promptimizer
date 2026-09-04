# Optimizer domain (TypeScript)

Production routing primitives for the Next.js gateway.

| File | Role |
| --- | --- |
| `types.ts` | ModelProfile, requirements, quality profiles, decisions |
| `pricing.ts` | USD/token ↔ $/1M; never invent prices |
| `normalize.ts` | Provider `/models` → ModelProfile |
| `requirements.ts` | Derive RequestRequirements from chat body |
| `capabilities.ts` | Capability filter + rejection reasons |
| `cost.ts` | Cost estimation |
| `router.ts` | Cheapest qualifying model (`quality_profile`) |
| `optimizer.test.ts` | Unit tests (`npm test` in this package) |

Wired from [`../engine.ts`](../engine.ts). Conceptual origin: `references/llm-cost-optimizer/`.
