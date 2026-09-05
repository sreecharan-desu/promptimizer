#!/usr/bin/env node
/**
 * Integration test: upsert + semantic search against Qdrant Cloud / local.
 * Loads repo-root .env. Usage: node scripts/test-qdrant-semantic.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

if (!process.env.QDRANT_URL) {
  console.error("Missing QDRANT_URL in .env");
  process.exit(1);
}

const cachePath = pathToFileURL(join(root, "apps/web/src/server/semantic-cache.ts")).href;
const embedPath = pathToFileURL(join(root, "apps/web/src/server/embeddings.ts")).href;
const qPath = pathToFileURL(join(root, "apps/web/src/server/qdrant-semantic.ts")).href;

const { rememberSemantic, findSimilar } = await import(cachePath);
const { embeddingBackend, embeddingDim, embeddingModel } = await import(embedPath);
const { ensureSemanticCollection, qdrantCollection } = await import(qPath);

const owner = `qdrant-test-${Date.now()}`;
console.log("backend", embeddingBackend());
console.log("model", embeddingBackend() === "nvidia" ? embeddingModel() : "local-hash");
console.log("dim", embeddingDim());
console.log("collection", qdrantCollection());

await ensureSemanticCollection();
console.log("collection ready");

await rememberSemantic({
  prompt: "What is 17 * 24?",
  answer: "408",
  model: "test-model",
  tier: "economy",
  quality: 0.97,
  owner,
});
console.log("upserted");

const hits = [
  ["exact", "What is 17 * 24?"],
  ["ellipsis", "What is 17 * 24?..."],
  ["paraphrase", "What is 17 times 24?"],
  ["unrelated", "What is the capital of France?"],
];

let failed = 0;
for (const [label, prompt] of hits) {
  const match = await findSimilar(prompt, owner);
  const mode = match?.mode ?? "null";
  const answer = match?.entry?.answer ?? "";
  const sim = match?.similarity ?? 0;
  const ok =
    label === "unrelated"
      ? mode === "miss" || mode === "null" || answer !== "408"
      : mode === "full" && answer === "408";
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(12)} mode=${mode} sim=${sim.toFixed(3)} answer=${JSON.stringify(answer)}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Qdrant semantic checks passed");
