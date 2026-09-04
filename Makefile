.PHONY: dev dev-api dev-web test lint install docker-up docker-down

install:
	pnpm install
	cd apps/api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

dev-api:
	cd apps/api && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	pnpm --filter @promptimizer/web dev

dev:
	@echo "Start API: make dev-api  |  Start web: make dev-web  |  Or: docker compose up --build"

test:
	cd apps/api && (test -x .venv/bin/pytest && .venv/bin/pytest -q || python3 -m pytest -q)
	npm run test --workspace=promptimizer
	npm run test --workspace=@promptimizer/web

lint:
	cd apps/api && (test -x .venv/bin/ruff && .venv/bin/ruff check app tests || true)
	npm run lint

docker-up:
	docker compose up --build

docker-down:
	docker compose down -v
