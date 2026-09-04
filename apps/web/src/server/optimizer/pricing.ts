import type { ModelPricing, TokenPrice } from "./types";

/** Convert USD per 1M tokens → USD per token. */
export function fromPerMillion(usdPer1m: number | null | undefined): TokenPrice | null {
  if (usdPer1m == null || !Number.isFinite(usdPer1m) || usdPer1m < 0) return null;
  return { usd_per_token: usdPer1m / 1_000_000 };
}

export function toPerMillion(price: TokenPrice | null | undefined): number | null {
  if (!price) return null;
  return price.usd_per_token * 1_000_000;
}

/** Parse provider string/number prices; never invent. */
export function parseTokenPrice(raw: unknown): TokenPrice | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    // Heuristic: values >= 0.001 look like $/1M; tiny values are already $/token.
    if (raw >= 0.001) return fromPerMillion(raw);
    return { usd_per_token: raw };
  }
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (!Number.isFinite(n) || n < 0) return null;
    return parseTokenPrice(n);
  }
  return null;
}

export function buildPricing(input: {
  prompt_per_1m?: number | null;
  completion_per_1m?: number | null;
  cache_read_per_1m?: number | null;
}): ModelPricing {
  const prompt = fromPerMillion(input.prompt_per_1m ?? null);
  const completion = fromPerMillion(input.completion_per_1m ?? null);
  return {
    prompt,
    completion,
    input_cache_read: fromPerMillion(input.cache_read_per_1m ?? null),
    image: null,
    request: null,
    known: Boolean(prompt && completion),
  };
}

export function pricingFromProviderMeta(meta: Record<string, unknown> | null | undefined): ModelPricing | null {
  if (!meta) return null;
  const pricing = (meta.pricing ?? meta.price) as Record<string, unknown> | undefined;
  if (!pricing || typeof pricing !== "object") return null;
  const prompt =
    parseTokenPrice(pricing.prompt ?? pricing.input ?? pricing.input_cost_per_token) ??
    parseTokenPrice(pricing.input_per_million_tokens);
  const completion =
    parseTokenPrice(pricing.completion ?? pricing.output ?? pricing.output_cost_per_token) ??
    parseTokenPrice(pricing.output_per_million_tokens);
  if (!prompt && !completion) return null;
  const cache = parseTokenPrice(pricing.input_cache_read ?? pricing.cache_read);
  return {
    prompt,
    completion,
    input_cache_read: cache,
    image: parseTokenPrice(pricing.image),
    request: parseTokenPrice(pricing.request),
    known: Boolean(prompt && completion),
  };
}
