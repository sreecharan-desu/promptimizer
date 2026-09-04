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
  baseURL?: string;
  apiKey?: string;
  gatewayURL?: string;
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
