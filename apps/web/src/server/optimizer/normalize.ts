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

  return {
    provider_id: providerId,
    model_id: modelId,
    display_name: modelId,
    description: raw.description ? String(raw.description) : null,
    context_length:
      typeof raw.context_length === "number"
        ? raw.context_length
        : typeof raw.max_model_len === "number"
          ? raw.max_model_len
          : null,
    max_completion_tokens:
      typeof raw.max_completion_tokens === "number"
        ? raw.max_completion_tokens
        : typeof raw.max_tokens === "number"
          ? raw.max_tokens
          : null,
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
