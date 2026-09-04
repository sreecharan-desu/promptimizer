install:
	python -m pip install -e ".[dev]"

install-all:
	python -m pip install -e ".[dev,ai,rag]"

run:
	uvicorn app.main:app --reload

test:
	pytest -q

lint:
	ruff check .

format:
	ruff format .

docker-up:
	docker compose up --build

docker-down:
	docker compose down
