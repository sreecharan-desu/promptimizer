/** Domain contracts adapted from references/llm-cost-optimizer (ZIP core). */

export type TaskType =
  | "factual_qa"
  | "summarization"
  | "extraction"
  | "coding"
  | "debugging"
  | "reasoning"
  | "long_context"
  | "vision"
  | "general";

export type RoutingPolicy = "bootstrap_heuristic" | "quality_profile";

/** Canonical money unit: USD per token (number; compare via integer micros helpers). */
export type TokenPrice = {
  usd_per_token: number;
};

export type ModelPricing = {
  prompt: TokenPrice | null;
  completion: TokenPrice | null;
  input_cache_read: TokenPrice | null;
  image: TokenPrice | null;
  request: TokenPrice | null;
  /** True when both prompt and completion are known (catalog or provider). */
  known: boolean;
};

export type ModelProfile = {
  provider_id: string;
  model_id: string;
  display_name: string;
  description: string | null;
  context_length: number | null;
  max_completion_tokens: number | null;
  pricing: ModelPricing | null;
  supported_features: string[];
  supported_sampling_parameters: string[];
  input_modalities: string[];
  output_modalities: string[];
};

export type RequestRequirements = {
  requires_tools: boolean;
  requires_reasoning: boolean;
  requires_structured_output: boolean;
  requires_vision: boolean;
  minimum_context_tokens: number;
  minimum_output_tokens: number;
  task_type: TaskType;
};

export type CapabilityCheckResult = {
  model_id: string;
  eligible: boolean;
  reasons: string[];
};

export type CostEstimate = {
  input_tokens: number;
  output_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  cache_cost_usd: number;
  total_cost_usd: number;
  estimated: boolean;
};

export type ModelQualityProfile = {
  model_id: string;
  overall_quality: number;
  reasoning_quality: number;
  coding_quality: number;
  extraction_quality: number;
  factual_quality: number;
  source_benchmark_id?: string | null;
  updated_at?: string | null;
};

export type RoutingCandidate = {
  model_id: string;
  estimated_quality: number;
  estimated_cost_usd: number;
  pricing_known: boolean;
  capability: CapabilityCheckResult;
};

export type RoutingDecision = {
  policy: RoutingPolicy;
  selected_model_id: string;
  estimated_quality: number;
  estimated_cost_usd: number;
  minimum_quality: number;
  requirements: RequestRequirements;
  rejected: CapabilityCheckResult[];
  quality_ineligible: string[];
  pricing_unknown: string[];
  rationale: string;
  candidates: RoutingCandidate[];
};
