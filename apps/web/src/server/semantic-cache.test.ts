import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cosineSimilarity, embedText, extractNovelParts } from "./semantic-cache";
import { runQualityGate, shouldRunAccuracyAudit } from "./quality-gate";

describe("semantic cache vectors", () => {
  it("embeds similar prompts closer than unrelated ones", () => {
    const a = embedText("Design a Redis rate limiter for 1M QPS across regions");
    const b = embedText("Design a redis rate-limiter for one million QPS multi-region");
    const c = embedText("What is the capital of France?");
    const simAb = cosineSimilarity(a, b);
    const simAc = cosineSimilarity(a, c);
    assert.ok(simAb > 0.5, `expected similar prompts >0.5 got ${simAb}`);
    assert.ok(simAb > simAc, `expected ${simAb} > ${simAc}`);
  });

  it("extracts novel parts from a related prompt", () => {
    const cached = "Explain TCP versus UDP. Give three UDP use cases.";
    const next = "Explain TCP versus UDP. Give three UDP use cases. Also compare SCTP briefly.";
    const { novel, shared_ratio } = extractNovelParts(next, cached);
    assert.ok(shared_ratio > 0.3);
    assert.match(novel.toLowerCase(), /sctp/);
  });
});

describe("quality gate", () => {
  it("fails thin refusals", () => {
    const result = runQualityGate({
      answer: "I don't know. Too complex for me.",
      prompt: "Design a multi-region rate limiter with Redis",
      complexity: 5,
      audit: true,
    });
    assert.equal(result.gate, "fail");
  });

  it("audits on every Nth ordinal", () => {
    assert.equal(shouldRunAccuracyAudit(5), true);
    assert.equal(shouldRunAccuracyAudit(4), false);
  });
});
