import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyText } from "./classify.ts";

test("easy factual stays economy", () => {
  const result = classifyText("What is the capital of France?");
  assert.equal(result.recommended_tier, "economy");
  assert.ok(result.p_small_quality >= 0.9);
  assert.ok(result.complexity <= 2);
});

test("easy math stays cheap", () => {
  const result = classifyText("What is 17 * 24? Reply with only the number.");
  assert.ok(result.complexity <= 2);
  assert.ok(["economy", "standard"].includes(result.recommended_tier));
});

test("system design goes frontier", () => {
  const result = classifyText(
    "Design a rate limiter that supports 1 million QPS across 50 edge regions and discuss consistency.",
  );
  assert.equal(result.recommended_tier, "frontier");
  assert.equal(result.category, "system_design");
  assert.ok(result.complexity >= 4);
  assert.ok(result.p_small_quality < 0.72);
});

test("raft consensus is hard system design", () => {
  const result = classifyText(
    "Explain Raft leader election and log replication for a 5-node cluster. Include what happens on network partition (2 vs 3). Use short paragraphs; mention quorum, term, and commit index.",
  );
  assert.equal(result.category, "system_design");
  assert.ok(result.complexity >= 4, `complexity ${result.complexity}`);
  assert.ok(
    result.recommended_tier === "frontier" || result.recommended_tier === "standard",
    result.recommended_tier,
  );
  assert.notEqual(result.recommended_tier, "economy");
});

test("euclid proof is reasoning L4+", () => {
  const result = classifyText(
    "Give a short proof sketch that there are infinitely many primes. Start from Euclid's argument. Keep it under 150 words.",
  );
  assert.equal(result.category, "reasoning");
  assert.ok(result.complexity >= 4, `complexity ${result.complexity}`);
  assert.notEqual(result.recommended_tier, "economy");
});

test("multi-constraint billing architecture is hard", () => {
  const result = classifyText(
    "You are designing a multi-tenant SaaS billing pipeline. Requirements: (1) idempotent charge retries, (2) exactly-once ledger writes, (3) late webhook reconciliation, (4) GDPR erasure without breaking audit. Outline architecture, data model keys, and failure recovery in under 300 words. Mention outbox or equivalent.",
  );
  assert.equal(result.category, "system_design");
  assert.ok(result.complexity >= 4, `complexity ${result.complexity}`);
  assert.equal(result.recommended_tier, "frontier");
});

test("code review with concurrency is not economy", () => {
  const result = classifyText(`Review this Python for correctness and concurrency hazards. List bugs as a numbered list, then a fixed version.

\`\`\`python
cache = {}
def get(key):
    if key in cache: return cache[key]
    value = expensive(key)
    cache[key] = value
    return value
\`\`\``);
  assert.ok(result.complexity >= 3);
  assert.notEqual(result.recommended_tier, "economy");
});
