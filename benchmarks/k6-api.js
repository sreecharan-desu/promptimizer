// k6 load test for the Promptimizer FastAPI gateway (apps/api).
// Measures router overhead only: /health and /v1/classify (difficulty classifier).
// No upstream LLM is called, so these numbers exclude provider latency.
import http from "k6/http";
import { check } from "k6";

const BASE = __ENV.BASE_URL || "http://127.0.0.1:8000";
const ENDPOINT = __ENV.ENDPOINT || "classify";

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || "30s",
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const prompts = [
  "What is 17 * 24?",
  "Translate 'good morning' to French.",
  "Design a multi-region event-sourced payment ledger with exactly-once settlement, explain the trade-offs and give a migration plan from a monolith.",
  "Summarize the plot of Hamlet in two sentences.",
  "Write a Python function that merges overlapping intervals and explain its complexity.",
];

export default function () {
  let res;
  if (ENDPOINT === "health") {
    res = http.get(`${BASE}/health`);
  } else {
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    res = http.post(`${BASE}/v1/classify`, JSON.stringify({ prompt }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  check(res, { "status 200": (r) => r.status === 200 });
}
