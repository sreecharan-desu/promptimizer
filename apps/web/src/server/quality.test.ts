import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateQualityGate, stage1Deterministic } from "./quality";

describe("quality gate stage 1", () => {
  it("escalates confidently wrong answers via must_not_include", async () => {
    let judgeCalled = 0;
    const verdict = await evaluateQualityGate({
      answer: "Yes, delete everything older than 30 days including compliance archives.",
      prompt: "Critique this cost-cutting plan.",
      complexity: 4,
      must_include: ["compliance", "risk"],
      must_not_include: ["delete everything", "including compliance"],
      allow_expensive: true,
      force_no_judge: true,
      judge: async () => {
        judgeCalled += 1;
        return "{}";
      },
    });
    assert.equal(verdict.escalate, true);
    assert.equal(verdict.gate, "fail");
    assert.equal(verdict.confident, true);
    assert.equal(judgeCalled, 0);
  });

  it("does not escalate a correct short answer", async () => {
    const paris = await evaluateQualityGate({
      answer: "Paris",
      prompt: "What is the capital of France?",
      complexity: 1,
      must_include: ["Paris"],
      allow_expensive: true,
      force_no_judge: true,
      random: () => 0.99,
    });
    assert.equal(paris.escalate, false);
    assert.equal(paris.gate, "pass");
    assert.ok(paris.score >= 0.75);

    const math = stage1Deterministic({
      answer: "408",
      prompt: "What is 17 * 24? Reply with only the number.",
      complexity: 1,
      must_include: ["408"],
    });
    assert.equal(math.gate, "pass");
    assert.equal(math.confident, true);
  });

  it("escalates refusals", async () => {
    const verdict = await evaluateQualityGate({
      answer: "I don't know. Too complex for me as a small model.",
      prompt: "Design a multi-region rate limiter",
      complexity: 5,
      allow_expensive: true,
      force_no_judge: true,
    });
    assert.equal(verdict.escalate, true);
    assert.equal(verdict.gate, "fail");
    assert.ok(verdict.reasons.includes("refusal"));
  });

  it("does not call stage 3 when stage 1 is confident", async () => {
    let judgeCalled = 0;
    const verdict = await evaluateQualityGate({
      answer: "Paris",
      prompt: "What is the capital of France?",
      complexity: 1,
      must_include: ["Paris"],
      allow_expensive: true,
      fleet: [{ id: "a" }, { id: "b/other" }],
      routed_model: "a",
      random: () => 0, // would sample judge if uncertain
      judge: async () => {
        judgeCalled += 1;
        return JSON.stringify({ correctness: 1, completeness: 1, usefulness: 1 });
      },
    });
    assert.equal(verdict.confident, true);
    assert.equal(verdict.stage, 1);
    assert.equal(judgeCalled, 0);
    assert.equal(verdict.stage3_skipped, true);
  });
});
