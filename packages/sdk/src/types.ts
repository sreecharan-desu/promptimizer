export type Tier = "economy" | "standard" | "frontier";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string | Array<{ type: string; text?: string }>;
  name?: string;
};

export type Classification = {
  complexity: number;
  category: string;
  confidence: number;
  recommended_tier: Tier;
  quality_risk: "low" | "medium" | "high";
  p_small_quality: number;
  uncertainty: number;
  structured_output: boolean;
  context_tokens_est: number;
  rationale: string;
  features: Record<string, unknown>;
};

export type ModelInfo = {
  id: string;
  owned_by?: string;
  input_per_1m?: number | null;
  output_per_1m?: number | null;
  tier: Tier;
  source?: string;
  selected?: boolean;
};

export type ConnectOptions = {
  mode?: "mock" | "byok";
  label?: string;
  provider?: string;
  baseURL?: string;
  apiKey?: string;
  accountKey?: string;
  gatewayURL?: string;
};

export type SavingsSummary = {
  requests: number;
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  saved_pct: number;
  routing_saved_usd: number;
  cache_saved_usd: number;
  cache_hits: number;
  escalations: number;
  avg_quality: number | null;
  recent: Array<{
    id: string;
    model: string;
    tier: string;
    actual_usd: number;
    baseline_usd: number;
    saved_usd: number;
    routing_saved_usd: number;
    cache_saved_usd: number;
    cache_hit: boolean;
    escalated: boolean;
    quality: number | null;
    created_at: string;
  }>;
};

export type PromptimizerOptions = {
  gatewayURL?: string;
  sessionId?: string;
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
};

export type ChatCompletionRequest = {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  level_override?: number;
  temperature?: number;
  max_tokens?: number;
};

export type CostBreakdown = {
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  saved_pct: number;
  routing_saved_usd: number;
  cache_discount_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
};

export type ChatCompletion = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: CostBreakdown;
  };
  promptimizer?: Record<string, unknown>;
};

export type Session = {
  session_id: string;
  mode: string;
  label: string;
  base_url: string;
  models: ModelInfo[];
  baseline_model: string | null;
  stats: Record<string, number>;
  created_at: number;
};
