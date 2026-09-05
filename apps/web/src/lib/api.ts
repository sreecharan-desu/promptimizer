export type Session = {
  session_id: string;
  mode: string;
  label: string;
  base_url: string;
  connections?: Array<{ id: string; label: string; base_url: string }>;
  models: Array<{
    id: string;
    owned_by?: string;
    input_per_1m?: number | null;
    output_per_1m?: number | null;
    tier: "economy" | "standard" | "frontier";
    source?: string;
    selected?: boolean;
    provider_id?: string;
    provider_label?: string;
    context_length?: number | null;
    pricing_known?: boolean;
    pricing_source?: "catalog" | "provider" | "estimate" | "unknown";
    overall_quality?: number | null;
    supported_features?: string[];
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

async function request<T>(path: string, init: RequestInit = {}, opts?: { timeoutMs?: number }): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const session = readSessionId();
  if (session) headers.set("X-Promptimizer-Session", session);
  const timeoutMs = opts?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
      signal: controller?.signal ?? init.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = (data as { detail?: string }).detail ?? response.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timed out waiting for the server. Try again, or use fewer selected models.");
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  quality_profiles?: Array<{
    model_id: string;
    overall_quality: number;
    reasoning_quality?: number;
    coding_quality?: number;
    extraction_quality?: number;
    factual_quality?: number;
  }>;
  session?: Session;
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
  connect: (body: { mode?: "byok"; label?: string; provider?: string; base_url?: string; api_key?: string }) =>
    request<Session>("/api/v1/providers/connect", { method: "POST", body: JSON.stringify(body) }),
  disconnect: (body: { provider: string }) =>
    request<Session & { removed?: { id: string; label: string } }>("/api/v1/providers/disconnect", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
  /** OpenAI-compatible SSE stream. Calls onDelta as tokens arrive; resolves with the final completion. */
  chatStream: async (
    messages: Array<{ role: string; content: string }>,
    model = "auto",
    handlers?: { onDelta?: (fullText: string, chunk: string) => void },
  ): Promise<Record<string, unknown>> => {
    const headers = new Headers({ "Content-Type": "application/json" });
    const session = readSessionId();
    if (session) headers.set("X-Promptimizer-Session", session);
    const response = await fetch("/api/v1/chat/completions", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ messages, model, stream: true }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const detail = (data as { detail?: string }).detail ?? response.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    if (!response.body) {
      throw new Error("No response body from stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let modelId: string | undefined;
    let usage: unknown;
    let promptimizer: unknown;
    let id = `chatcmpl-${Date.now()}`;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed: {
          id?: string;
          model?: string;
          error?: { message?: string };
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
          usage?: unknown;
          promptimizer?: unknown;
        };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (parsed.error?.message) throw new Error(parsed.error.message);
        if (parsed.id) id = parsed.id;
        if (parsed.model) modelId = parsed.model;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          handlers?.onDelta?.(text, delta);
        }
        if (parsed.usage) usage = parsed.usage;
        if (parsed.promptimizer) promptimizer = parsed.promptimizer;
      }
    }

    return {
      id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelId ?? model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: "stop",
        },
      ],
      usage,
      promptimizer,
    };
  },
  benchmark: () =>
    request<BenchmarkResult>(
      "/api/v1/benchmark/run",
      {
        method: "POST",
        body: JSON.stringify({ compare_always_frontier: true }),
      },
      { timeoutMs: 280_000 },
    ),
  analytics: () => request("/api/v1/analytics"),
};
