#!/usr/bin/env bash
# Reproduce: starts the FastAPI gateway locally and runs k6 against it.
# Requires: python3.12 venv at apps/api/.venv with ".[dev]" installed, k6 on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="benchmarks/results-$(date +%F)"
mkdir -p "$OUT"
{ echo "date: $(date -Is)"; echo "cpu: $(nproc) x $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2)"; free -m | sed -n 2p | awk '{print "ram_mb: "$2}'; uname -sr; apps/api/.venv/bin/python -V; k6 version; echo "uvicorn workers: 4"; echo "load generator: k6 on the same machine"; } > "$OUT/environment.txt"
(cd apps/api && .venv/bin/pytest -q --cov=app --cov-report=term) > "$OUT/pytest-coverage.txt" 2>&1 || true
(cd apps/api && CACHE_BACKEND=memory SEMANTIC_CACHE=false .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4 --log-level warning) &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 50); do curl -sf http://127.0.0.1:8000/health >/dev/null && break; sleep 0.2; done
k6 run -e ENDPOINT=health -e VUS=50 --summary-export "$OUT/k6-health.json" benchmarks/k6-api.js > "$OUT/k6-health.txt" 2>&1
k6 run -e ENDPOINT=classify -e VUS=50 --summary-export "$OUT/k6-classify-50vu.json" benchmarks/k6-api.js > "$OUT/k6-classify-50vu.txt" 2>&1
k6 run -e ENDPOINT=classify -e VUS=200 --summary-export "$OUT/k6-classify-200vu.json" benchmarks/k6-api.js > "$OUT/k6-classify-200vu.txt" 2>&1
