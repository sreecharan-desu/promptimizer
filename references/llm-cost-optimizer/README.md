# LLM Cost Optimizer — reference only

This tree is the attached experimental / foundation package used to guide
Promptimizer's optimizer domain. **It is not a deployable app in this monorepo.**

## Where the real code lives

| Concern | Production path |
| --- | --- |
| Schemas, cost, capability filter, quality router (TS) | `apps/web/src/server/optimizer/` |
| Live chat + benchmark | `apps/web/src/server/engine.ts` |
| Python twin | `apps/api/app/domain/optimizer/` |
| Engineering notes | `docs/optimizer.md` |
| Repo map | `STRUCTURE.md` |

## Contents

- `README.txt` — original design notes from the ZIP
- `app/` — reference FastAPI core (schemas, routing, cost, discovery)
- `config/providers.yaml` — sample provider catalog
- `notebooks/` — `01-trails.ipynb` + ZIP notebook copy
- `tests/` — original unit tests (informational)

Do not `pip install -e` this package for production. Do not point Docker or Vercel at this folder.
