import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCapabilities } from "./capabilities";
import { estimateCost } from "./cost";
import { buildPricing } from "./pricing";
import { extractRequirements } from "./requirements";
import { chooseModel } from "./router";
import type { ModelProfile, ModelQualityProfile } from "./types";

function demoModel(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return {
    provider_id: "openai",
    model_id: "demo",
    display_name: "Demo",
    description: null,
    context_length: 100_000,
    max_completion_tokens: 10_000,
    pricing: buildPricing({ prompt_per_1m: 0.1, completion_per_1m: 0.5 }),
    supported_features: ["tools", "reasoning", "structured_outputs"],
    supported_sampling_parameters: [],
    input_modalities: ["text", "image"],
    output_modalities: ["text"],
    ...overrides,
  };
}

describe("optimizer core", () => {
  it("capability checker accepts full feature set", () => {
    const result = checkCapabilities(demoModel(), {
      requires_tools: true,
      requires_reasoning: true,
      requires_structured_output: true,
      requires_vision: true,
      minimum_context_tokens: 50_000,
      minimum_output_tokens: 8_000,
      task_type: "reasoning",
    });
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
  });

  it("estimates cost in USD per token units", () => {
    const estimate = estimateCost(demoModel(), 2000, 500);
    assert.ok(Math.abs(estimate.total_cost_usd - 0.00045) < 1e-12);
  });

  it("extracts vision and tools from chat body", () => {
    const req = extractRequirements({
      tools: [{ type: "function" }],
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "describe" }, { type: "image_url", image_url: { url: "x" } }],
        },
      ],
    });
    assert.equal(req.requires_tools, true);
    assert.equal(req.requires_vision, true);
  });

  it("chooses cheapest quality-eligible model", () => {
    const cheap = demoModel({
      model_id: "cheap",
      pricing: buildPricing({ prompt_per_1m: 0.1, completion_per_1m: 0.2 }),
    });
    const pricey = demoModel({
      model_id: "pricey",
      pricing: buildPricing({ prompt_per_1m: 5, completion_per_1m: 15 }),
    });
    const profiles: Record<string, ModelQualityProfile> = {
      cheap: {
        model_id: "cheap",
        overall_quality: 0.95,
        reasoning_quality: 0.95,
        coding_quality: 0.95,
        extraction_quality: 0.95,
        factual_quality: 0.95,
      },
      pricey: {
        model_id: "pricey",
        overall_quality: 0.99,
        reasoning_quality: 0.99,
        coding_quality: 0.99,
        extraction_quality: 0.99,
        factual_quality: 0.99,
      },
    };
    const decision = chooseModel({
      models: [pricey, cheap],
      requirements: {
        requires_tools: false,
        requires_reasoning: false,
        requires_structured_output: false,
        requires_vision: false,
        minimum_context_tokens: 100,
        minimum_output_tokens: 0,
        task_type: "general",
      },
      qualityProfiles: profiles,
      minimumQuality: 0.9,
    });
    assert.ok(decision);
    assert.equal(decision!.selected_model_id, "cheap");
    assert.equal(decision!.policy, "quality_profile");
  });
});
