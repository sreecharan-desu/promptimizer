import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyText } from "./classify.ts";

test("easy factual stays economy", () => {
  const result = classifyText("What is the capital of France?");
  assert.equal(result.recommended_tier, "economy");
  assert.ok(result.complexity <= 2);
});

test("system design goes frontier", () => {
  const result = classifyText(
    "Design a rate limiter that supports 1 million QPS across 50 edge regions and discuss consistency.",
  );
  assert.equal(result.recommended_tier, "frontier");
  assert.equal(result.category, "system_design");
});
