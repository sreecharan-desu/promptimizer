import type { CostEstimate, ModelProfile } from "./types";

export function estimateCost(
  model: ModelProfile,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): CostEstimate {
  if (!model.pricing?.known || !model.pricing.prompt || !model.pricing.completion) {
    throw new Error(`No pricing information for '${model.model_id}'`);
  }
  const inputBillable = Math.max(0, inputTokens - cacheReadTokens);
  const inputCost = inputBillable * model.pricing.prompt.usd_per_token;
  const outputCost = outputTokens * model.pricing.completion.usd_per_token;
  let cacheCost = 0;
  if (cacheReadTokens > 0 && model.pricing.input_cache_read) {
    cacheCost = cacheReadTokens * model.pricing.input_cache_read.usd_per_token;
  } else if (cacheReadTokens > 0) {
    // Fallback: half input rate for cached tokens (matches existing engine heuristic).
    cacheCost = cacheReadTokens * model.pricing.prompt.usd_per_token * 0.5;
  }
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    input_cost_usd: inputCost,
    output_cost_usd: outputCost,
    cache_cost_usd: cacheCost,
    total_cost_usd: inputCost + outputCost + cacheCost,
    estimated: true,
  };
}

/** Planning estimate using expected I/O sizes when usage is unknown. */
export function estimatePlanningCost(model: ModelProfile, expectedIn: number, expectedOut: number): number {
  try {
    return estimateCost(model, expectedIn, expectedOut, 0).total_cost_usd;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
