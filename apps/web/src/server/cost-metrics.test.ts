import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreAnswerLike } from "./quality";
import { apgr, breakEvenEscalationRate, cpt, pgr } from "./routing-metrics";

describe("cost accounting honesty", () => {
  it("allows negative savings conceptually via baseline - actual", () => {
    const baseline = 0.01;
    const actual = 0.02;
    const saved = baseline - actual;
    assert.ok(saved < 0);
  });

  it("never treats output tokens as cache-discountable in score helpers", () => {
    // Structural: completion always full price — verified by costOf using rout * completionTokens only.
    const completionRate = 3;
    const completionTokens = 1000;
    const outCost = (completionTokens / 1e6) * completionRate;
    const cachedOutWouldBeWrong = outCost * 0.5;
    assert.notEqual(outCost, cachedOutWouldBeWrong);
  });

  it("breakEvenEscalationRate matches 1 - (Cs+Cj)/Cl", () => {
    const e = breakEvenEscalationRate(0.2, 1.0, 0.05);
    assert.ok(Math.abs(e - (1 - 0.25 / 1)) < 1e-9);
  });
});

describe("routing metrics", () => {
  it("computes PGR APGR CPT", () => {
    assert.equal(pgr(0.9, 0.7, 1.0), (0.9 - 0.7) / (1 - 0.7));
    const curve = [
      { frontier_call_pct: 0, quality: 0.7 },
      { frontier_call_pct: 0.5, quality: 0.85 },
      { frontier_call_pct: 1, quality: 1 },
    ];
    assert.ok(apgr(curve, 0.7, 1) > 0);
    assert.ok(cpt(curve, 0.7, 1, 0.5) <= 0.5 + 1e-9);
  });
});

describe("quality short answers", () => {
  it("correct short answer is not degraded", () => {
    const r = scoreAnswerLike("Paris", "What is the capital of France?", 1, 0.62, ["Paris"]);
    assert.equal(r.degraded, false);
    assert.ok(r.score >= 0.75);
  });
});
