import assert from "node:assert/strict";
import { test } from "node:test";
import { findProvider, publicCatalog, resolveBaseURL } from "./providers.ts";

test("known providers resolve without a base URL", () => {
  const baseten = resolveBaseURL({ provider: "baseten" });
  assert.equal(baseten.baseURL, "https://inference.baseten.co/v1");
  assert.equal(baseten.provider?.id, "baseten");
  assert.equal(resolveBaseURL({ provider: "Groq" }).baseURL, "https://api.groq.com/openai/v1");
});

test("unknown providers stay empty until a URL is passed", () => {
  assert.equal(resolveBaseURL({ provider: "acme-lab" }).baseURL, null);
  assert.equal(findProvider("acme-lab"), null);
  assert.equal(resolveBaseURL({ provider: "acme-lab", baseURL: "https://llm.acme.test/v1" }).baseURL, "https://llm.acme.test/v1");
});

test("catalog is public and includes Baseten", () => {
  const ids = publicCatalog().map((row) => row.id);
  assert.ok(ids.includes("baseten"));
  assert.ok(ids.includes("openai"));
  assert.ok(!publicCatalog().some((row) => "hint" in row));
});
