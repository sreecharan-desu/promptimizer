import { buildPricing, pricingFromProviderMeta, toPerMillion } from "./pricing";
import type { ModelProfile, ModelQualityProfile, TaskType } from "./types";

type RawModel = {
  id?: string;
  name?: string;
  owned_by?: string;
  description?: string;
  context_length?: number;
  max_model_len?: number;
  max_completion_tokens?: number;
  max_tokens?: number;
  pricing?: Record<string, unknown>;
  supported_features?: string[];
  supported_sampling_parameters?: string[] | Record<string, unknown>;
  input_modalities?: string[];
  output_modalities?: string[];
  architecture?: { input_modalities?: string[]; output_modalities?: string[]; modality?: string };
  [key: string]: unknown;
};

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.keys(value as object);
  return [];
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

/** Pull context window from common OpenAI-compatible / NIM shapes. */
export function extractContextLength(raw: Record<string, unknown>): number | null {
  const direct =
    asPositiveInt(raw.context_length) ??
    asPositiveInt(raw.max_model_len) ??
    asPositiveInt(raw.max_context_length) ??
    asPositiveInt(raw.n_ctx) ??
    asPositiveInt(raw.context_window);
  if (direct) return direct;

  const nestedKeys = ["model_spec", "meta", "parameters", "info", "capabilities"] as const;
  for (const key of nestedKeys) {
    const nest = raw[key];
    if (!nest || typeof nest !== "object") continue;
    const obj = nest as Record<string, unknown>;
    const hit =
      asPositiveInt(obj.context_length) ??
      asPositiveInt(obj.max_model_len) ??
      asPositiveInt(obj.max_context_length) ??
      asPositiveInt(obj.n_ctx) ??
      asPositiveInt(obj.context_window);
    if (hit) return hit;
  }
  return null;
}

/** When providers omit context (common for NIM), estimate from the model id. */
export function estimateContextLength(modelId: string): number {
  const id = modelId.toLowerCase();
  const explicit = id.match(/(\d+)\s*[kK](?:-?ctx|-?context)?/);
  if (explicit) return Number(explicit[1]) * 1024;
  if (/128k|131k/.test(id)) return 131_072;
  if (/64k|65k/.test(id)) return 65_536;
  if (/32k/.test(id)) return 32_768;
  if (/16k/.test(id)) return 16_384;
  if (/8k/.test(id)) return 8_192;
  if (/4k/.test(id)) return 4_096;
  const params = id.match(/(\d+(?:\.\d+)?)\s*b(?:illion)?/);
  const billions = params ? Number(params[1]) : null;
  if (billions != null) {
    if (billions >= 70) return 65_536;
    if (billions >= 30) return 32_768;
    if (billions >= 7) return 8_192;
    return 4_096;
  }
  return 8_192;
}

/** Rough $/1M estimates by parameter class when catalog + provider omit rates. */
export function estimatePricingPer1m(modelId: string): { input: number; output: number } {
  const id = modelId.toLowerCase();
  if (/(opus|405b|ultra|frontier|o1(?!-mini)|o3(?!-mini))/.test(id)) return { input: 5, output: 15 };
  if (/(70b|72b|90b|120b|123b|235b)/.test(id)) return { input: 0.6, output: 1.8 };
  if (/(30b|32b|34b|40b|47b)/.test(id)) return { input: 0.4, output: 1.2 };
  if (/(13b|14b|15b|22b|27b)/.test(id)) return { input: 0.25, output: 0.75 };
  if (/(7b|8b|9b)/.test(id)) return { input: 0.12, output: 0.36 };
  if (/(1b|2b|3b|4b|mini|nano|tiny|lite|small)/.test(id)) return { input: 0.05, output: 0.15 };
  return { input: 0.35, output: 1.05 };
}

export function normalizeModel(raw: RawModel, providerId: string, catalog?: { input?: number; output?: number } | null): ModelProfile {
  const modelId = String(raw.id ?? raw.name ?? "");
  const fromProvider = pricingFromProviderMeta(raw as Record<string, unknown>);
  const fromCatalog =
    catalog && (catalog.input != null || catalog.output != null)
      ? buildPricing({ prompt_per_1m: catalog.input ?? null, completion_per_1m: catalog.output ?? null })
      : null;
  const pricing = fromProvider?.known ? fromProvider : fromCatalog?.known ? fromCatalog : fromProvider ?? fromCatalog;

  const features = asStringList(raw.supported_features);
  const sampling = asStringList(raw.supported_sampling_parameters);
  let inputMods =
    asStringList(raw.input_modalities).length > 0
      ? asStringList(raw.input_modalities)
      : asStringList(raw.architecture?.input_modalities);
  let outputMods =
    asStringList(raw.output_modalities).length > 0
      ? asStringList(raw.output_modalities)
      : asStringList(raw.architecture?.output_modalities);

  if (!inputMods.length) inputMods = ["text"];
  if (!outputMods.length) outputMods = ["text"];

  const contextFromProvider = extractContextLength(raw as Record<string, unknown>);

  return {
    provider_id: providerId,
    model_id: modelId,
    display_name: modelId,
    description: raw.description ? String(raw.description) : null,
    context_length: contextFromProvider,
    max_completion_tokens:
      asPositiveInt(raw.max_completion_tokens) ?? asPositiveInt(raw.max_tokens),
    pricing,
    supported_features: features,
    supported_sampling_parameters: sampling,
    input_modalities: inputMods,
    output_modalities: outputMods,
  };
}

export function profileToDisplayPrices(profile: ModelProfile): {
  input_per_1m: number | null;
  output_per_1m: number | null;
  pricing_known: boolean;
} {
  return {
    input_per_1m: toPerMillion(profile.pricing?.prompt ?? null),
    output_per_1m: toPerMillion(profile.pricing?.completion ?? null),
    pricing_known: Boolean(profile.pricing?.known),
  };
}

const CATEGORY_TO_TASK: Record<string, TaskType> = {
  coding: "coding",
  reasoning: "reasoning",
  extraction: "extraction",
  factual: "factual_qa",
  factual_qa: "factual_qa",
  summarization: "summarization",
  math: "reasoning",
  debugging: "debugging",
};

export function aggregateQualityProfiles(
  rows: Array<{ model_id: string; category: string; score: number }>,
  sourceBenchmarkId?: string,
): ModelQualityProfile[] {
  const byModel = new Map<
    string,
    { overall: number[]; reasoning: number[]; coding: number[]; extraction: number[]; factual: number[] }
  >();

  for (const row of rows) {
    let bucket = byModel.get(row.model_id);
    if (!bucket) {
      bucket = { overall: [], reasoning: [], coding: [], extraction: [], factual: [] };
      byModel.set(row.model_id, bucket);
    }
    bucket.overall.push(row.score);
    const task = CATEGORY_TO_TASK[row.category.toLowerCase()] ?? "general";
    if (task === "reasoning" || task === "debugging") bucket.reasoning.push(row.score);
    if (task === "coding" || task === "debugging") bucket.coding.push(row.score);
    if (task === "extraction") bucket.extraction.push(row.score);
    if (task === "factual_qa") bucket.factual.push(row.score);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return [...byModel.entries()].map(([model_id, b]) => {
    const overall = avg(b.overall);
    return {
      model_id,
      overall_quality: overall,
      reasoning_quality: b.reasoning.length ? avg(b.reasoning) : overall,
      coding_quality: b.coding.length ? avg(b.coding) : overall,
      extraction_quality: b.extraction.length ? avg(b.extraction) : overall,
      factual_quality: b.factual.length ? avg(b.factual) : overall,
      source_benchmark_id: sourceBenchmarkId ?? null,
      updated_at: new Date().toISOString(),
    };
  });
}
