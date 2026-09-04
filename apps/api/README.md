# Promptimizer API

OpenAI-compatible FastAPI gateway. Classifies each request, routes it to the cheapest adequate BYOK model, caches repeated system/context prefixes, and measures quality against an always-frontier baseline.

See `/docs` in the running server for the interactive OpenAPI explorer, and `../../docs/api.md` for the full reference.
