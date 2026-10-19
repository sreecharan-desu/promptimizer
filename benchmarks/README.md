# Benchmarks

`k6-api.js` load-tests the FastAPI gateway in `apps/api` (`/health` and `/v1/classify`). No upstream LLM is called, so the numbers are router overhead only.

`run.sh` installs nothing; it expects `apps/api/.venv` (`pip install -e ".[dev]" pytest-cov`) and `k6` on PATH, starts uvicorn with 4 workers on 127.0.0.1:8000, runs pytest with coverage, then three 30-second k6 runs. Results land in `results-<date>/` (k6 console output, `--summary-export` JSON, `environment.txt`).

All results are from a single machine with the load generator on the same box.
