import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cosineSimilarity,
  embedText,
  extractNovelParts,
  findSimilar,
  normalizeCachePrompt,
  rememberSemantic,
  semanticFullHit,
} from "./semantic-cache";
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

  it("treats trailing ellipsis as the same prompt for cache identity", () => {
    const a = "What is 17 * 24?";
    const b = "What is 17 * 24?...";
    assert.equal(normalizeCachePrompt(a), normalizeCachePrompt(b));
    const sim = cosineSimilarity(embedText(a), embedText(b));
    assert.ok(sim >= semanticFullHit(), `expected ≥${semanticFullHit()} got ${sim}`);
  });

  it("replays full semantic hit for punctuation-only near-duplicates", async () => {
    const owner = `test-ellipsis-${Date.now()}`;
    await rememberSemantic({
      prompt: "What is 17 * 24?",
      answer: "408",
      model: "test-model",
      tier: "economy",
      quality: 0.95,
      owner,
    });
    const match = await findSimilar("What is 17 * 24?...", owner);
    assert.equal(match?.mode, "full");
    assert.equal(match?.entry.answer, "408");
    assert.ok((match?.similarity ?? 0) >= semanticFullHit());
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

  it("scores short factual and numeric answers as decent", () => {
    const paris = runQualityGate({
      answer: "Paris",
      prompt: "What is the capital of France?",
      complexity: 1,
    });
    assert.ok(paris.score >= 0.75, `paris score ${paris.score}`);
    assert.equal(paris.gate, "pass");

    const math = runQualityGate({
      answer: "408",
      prompt: "What is 17 * 24? Reply with only the number.",
      complexity: 1,
    });
    assert.ok(math.score >= 0.75, `math score ${math.score}`);
    assert.equal(math.gate, "pass");
  });

  it("audits on every Nth ordinal", () => {
    assert.equal(shouldRunAccuracyAudit(5), true);
    assert.equal(shouldRunAccuracyAudit(4), false);
  });
});