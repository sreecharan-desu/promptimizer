import { checkCapabilities } from "./capabilities";
import { estimatePlanningCost } from "./cost";
import type {
  ModelProfile,
  ModelQualityProfile,
  RequestRequirements,
  RoutingCandidate,
  RoutingDecision,
  TaskType,
} from "./types";

function qualityForTask(profile: ModelQualityProfile, taskType: TaskType | undefined): number {
  if (taskType === "reasoning") return profile.reasoning_quality;
  if (taskType === "coding" || taskType === "debugging") return profile.coding_quality;
  if (taskType === "extraction") return profile.extraction_quality;
  if (taskType === "factual_qa") return profile.factual_quality;
  return profile.overall_quality;
}

export function defaultMinQuality(): number {
  const raw = Number(process.env.MIN_QUALITY ?? process.env.QUALITY_MIN ?? 0.72);
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.72;
}

export function chooseModel(input: {
  models: ModelProfile[];
  requirements: RequestRequirements;
  qualityProfiles: Map<string, ModelQualityProfile> | Record<string, ModelQualityProfile>;
  minimumQuality?: number;
  expectedInputTokens?: number;
  expectedOutputTokens?: number;
  /** When no profiles cover the fleet, caller should use bootstrap instead. */
}): RoutingDecision | null {
  const profiles =
    input.qualityProfiles instanceof Map
      ? input.qualityProfiles
      : new Map(Object.entries(input.qualityProfiles));

  const covered = input.models.filter((m) => profiles.has(m.model_id));
  if (!covered.length) return null;

  const minQ = input.minimumQuality ?? defaultMinQuality();
  const expectedIn = input.expectedInputTokens ?? Math.max(256, input.requirements.minimum_context_tokens);
  const expectedOut = input.expectedOutputTokens ?? Math.max(128, input.requirements.minimum_output_tokens || 256);

  const rejected: RoutingDecision["rejected"] = [];
  const qualityIneligible: string[] = [];
  const pricingUnknown: string[] = [];
  const candidates: RoutingCandidate[] = [];

  for (const model of input.models) {
    const capability = checkCapabilities(model, input.requirements);
    if (!capability.eligible) {
      rejected.push(capability);
      continue;
    }
    const profile = profiles.get(model.model_id);
    if (!profile) continue;
    const q = qualityForTask(profile, input.requirements.task_type);
    if (q < minQ) {
      qualityIneligible.push(model.model_id);
      continue;
    }
    if (!model.pricing?.known) {
      pricingUnknown.push(model.model_id);
      continue;
    }
    const cost = estimatePlanningCost(model, expectedIn, expectedOut);
    candidates.push({
      model_id: model.model_id,
      provider_id: model.provider_id,
      estimated_quality: q,
      estimated_cost_usd: cost,
      pricing_known: true,
      capability,
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.estimated_cost_usd - b.estimated_cost_usd || b.estimated_quality - a.estimated_quality);
  const best = candidates[0];
  const rationale = `Selected ${best.model_id} because capabilities satisfied, quality estimate = ${best.estimated_quality.toFixed(2)}, required quality = ${minQ.toFixed(2)}, expected cost = $${best.estimated_cost_usd.toFixed(6)}. Cheaper eligible alternatives did not satisfy quality or pricing constraints.`;

  return {
    policy: "quality_profile",
    selected_model_id: best.model_id,
    selected_provider_id: best.provider_id,
    estimated_quality: best.estimated_quality,
    estimated_cost_usd: best.estimated_cost_usd,
    minimum_quality: minQ,
    requirements: input.requirements,
    rejected,
    quality_ineligible: qualityIneligible,
    pricing_unknown: pricingUnknown,
    rationale,
    candidates,
  };
}
