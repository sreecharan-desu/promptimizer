import type { CapabilityCheckResult, ModelProfile, RequestRequirements } from "./types";

export function checkCapabilities(
  model: ModelProfile,
  requirements: RequestRequirements,
): CapabilityCheckResult {
  const reasons: string[] = [];
  const features = new Set(model.supported_features.map((f) => f.toLowerCase()));
  const modalities = new Set(model.input_modalities.map((m) => m.toLowerCase()));

  if (requirements.requires_tools) {
    if (
      features.size > 0 &&
      !features.has("tools") &&
      !features.has("tool_calling") &&
      !features.has("function_calling")
    ) {
      reasons.push("tool_calling_not_supported");
    }
  }
  if (requirements.requires_reasoning) {
    if (features.size > 0 && !features.has("reasoning") && !features.has("thinking")) {
      if (!/(o1|o3|reason|think|r1)/i.test(model.model_id)) {
        reasons.push("reasoning_not_supported");
      }
    }
  }
  if (
    requirements.requires_structured_output &&
    !features.has("structured_outputs") &&
    !features.has("json_mode") &&
    !features.has("response_format")
  ) {
    // Many chat models can still emit JSON; only hard-fail when explicitly lacking and flagged.
    if (features.size > 0 && !features.has("json")) {
      reasons.push("structured_outputs_not_supported");
    }
  }
  if (requirements.requires_vision && !modalities.has("image") && !modalities.has("vision")) {
    if (!/(vision|gpt-4o|gemini|claude-3|llava)/i.test(model.model_id)) {
      reasons.push("vision_not_supported");
    }
  }
  if (
    model.context_length != null &&
    requirements.minimum_context_tokens > 0 &&
    model.context_length < requirements.minimum_context_tokens
  ) {
    reasons.push("insufficient_context_window");
  }
  if (
    model.max_completion_tokens != null &&
    requirements.minimum_output_tokens > 0 &&
    model.max_completion_tokens < requirements.minimum_output_tokens
  ) {
    reasons.push("insufficient_max_output_tokens");
  }

  return {
    model_id: model.model_id,
    eligible: reasons.length === 0,
    reasons,
  };
}
