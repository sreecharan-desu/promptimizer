import type { Metadata } from "next";

export const metadata: Metadata = { title: "API" };

const ENDPOINTS = [
  {
    method: "POST",
    path: "/v1/providers/connect",
    body: '{ mode: "mock" | "byok", label?, base_url?, api_key? }',
    note: "Mock starts the simulator. BYOK lists /models on the provider and auto-tiers them.",
  },
  {
    method: "GET",
    path: "/v1/session",
    body: "Header X-Promptimizer-Session",
    note: "Public session. The raw key is never returned.",
  },
  {
    method: "GET",
    path: "/v1/models",
    body: "session",
    note: "OpenAI-shaped list plus tier, price, and selection flags.",
  },
  {
    method: "PATCH",
    path: "/v1/models",
    body: "{ overrides, selected, baseline_model }",
    note: "Correct the auto-tiering. Baseline is the always-expensive comparison model.",
  },
  {
    method: "POST",
    path: "/v1/classify",
    body: "{ prompt } | { messages }",
    note: "Complexity, category, recommended tier, quality risk. No model call.",
  },
  {
    method: "POST",
    path: "/v1/chat/completions",
    body: "OpenAI chat body + optional level_override, model: \"auto\"",
    note: "Routes, caches, maybe escalates. Adds usage.cost and promptimizer metadata.",
  },
  {
    method: "GET",
    path: "/v1/benchmark",
    body: "—",
    note: "The fixed 15-task spec with gold answers.",
  },
  {
    method: "POST",
    path: "/v1/benchmark/run",
    body: "{ compare_always_frontier }",
    note: "Runs routed vs frontier and returns cost + quality summaries.",
  },
  {
    method: "GET",
    path: "/v1/analytics",
    body: "session",
    note: "Cumulative savings for the current session.",
  },
  {
    method: "GET",
    path: "/health",
    body: "—",
    note: "Liveness + cache hit rate (FastAPI).",
  },
];

export default function ApiDocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="text-xs font-medium tracking-wide text-accent">API</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">
        OpenAI-compatible, with receipts.
      </h1>
      <p className="mt-6 text-lg text-secondary">
        FastAPI serves the same contract at <span className="text-primary">/docs</span> (Swagger). The Vercel app
        mirrors these routes under <span className="font-mono text-sm text-primary">/api/v1/*</span>.
      </p>
      <div className="mt-12 divide-y divide-primary/5">
        {ENDPOINTS.map((item) => (
          <section key={item.path} className="py-6">
            <p className="font-mono text-sm text-accent">{item.method}</p>
            <h2 className="mt-1 font-mono text-base text-primary">{item.path}</h2>
            <p className="mt-2 font-mono text-[13px] text-secondary">{item.body}</p>
            <p className="mt-3 leading-relaxed text-secondary">{item.note}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
