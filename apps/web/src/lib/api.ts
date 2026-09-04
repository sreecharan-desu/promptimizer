export type Session = {
  session_id: string;
  mode: string;
  label: string;
  base_url: string;
  models: Array<{
    id: string;
    owned_by?: string;
    input_per_1m?: number | null;
    output_per_1m?: number | null;
    tier: "economy" | "standard" | "frontier";
    source?: string;
    selected?: boolean;
  }>;
  baseline_model: string | null;
  stats: Record<string, number>;
  created_at: number;
};

const SESSION_KEY = "promptimizer-session";

export function readSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function writeSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const session = readSessionId();
  if (session) headers.set("X-Promptimizer-Session", session);
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as { detail?: string }).detail ?? response.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export type PolicySummary = {
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  saved_pct: number;
  routing_saved_usd: number;
  cache_saved_usd: number;
  avg_quality: number;
  worst_quality: number;
  quality_delta: number;
  avg_latency_ms: number;
  cache_hit_rate: number;
  escalation_rate: number;
  quality_fails: number;
  requests: number;
  small_model: number;
  frontier_direct: number;
  escalated: number;
  successful_escalations: number;
};

export type BenchmarkResult = {
  name: string;
  tasks: number;
  policies?: Record<string, PolicySummary>;
  summary: {
    actual_usd: number;
    baseline_usd: number;
    saved_usd: number;
    saved_pct: number;
    routing_saved_usd?: number;
    cache_saved_usd?: number;
    avg_quality_routed: number;
    avg_quality_frontier: number;
    worst_quality_routed?: number;
    quality_delta: number;
    avg_latency_ms?: number;
    cache_hit_rate?: number;
    escalation_rate?: number;
    escalations: number;
    cache_hits: number;
    quality_fails: number;
    small_model?: number;
    frontier_direct?: number;
    successful_escalations?: number;
  };
  rows: Array<{
    id: string;
    difficulty: number;
    category: string;
    prompt: string;
    model: string;
    tier: string;
    complexity: number;
    p_small_quality?: number;
    escalated: boolean;
    cost: { saved_pct: number };
    quality_routed: { score: number };
    quality_frontier: { score: number };
    quality_delta: number;
    answer: string;
    frontier_answer: string;
  }>;
};

export const api = {
  connect: (body: { mode: "mock" | "byok"; label?: string; provider?: string; base_url?: string; api_key?: string }) =>
    request<Session>("/api/v1/providers/connect", { method: "POST", body: JSON.stringify(body) }),
  session: () => request<Session>("/api/v1/session"),
  models: () => request<{ data: Session["models"]; baseline_model: string | null }>("/api/v1/models"),
  patchModels: (body: unknown) =>
    request<Session>("/api/v1/models", { method: "PATCH", body: JSON.stringify(body) }),
  classify: (prompt: string) =>
    request("/api/v1/classify", { method: "POST", body: JSON.stringify({ prompt }) }),
  chat: (messages: Array<{ role: string; content: string }>, model = "auto") =>
    request("/api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ messages, model }),
    }),
  benchmark: () =>
    request<BenchmarkResult>("/api/v1/benchmark/run", {
      method: "POST",
      body: JSON.stringify({ compare_always_frontier: true }),
    }),
  analytics: () => request("/api/v1/analytics"),
};
