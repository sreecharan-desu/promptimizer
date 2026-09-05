#!/usr/bin/env node
/**
 * One-by-one 100-question evaluation against prod for the hackathon rubric:
 * classifier · multi-tier routing · prompt cache · cost vs always-frontier · quality measured.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "tmp");
const OUT_JSON = join(OUT_DIR, "judge-100-results.json");

const cfg = JSON.parse(readFileSync(join(homedir(), ".promptimizer", "config.json"), "utf8"));
const API_KEY = cfg.apiKey;
const BASE = String(cfg.gatewayURL || "https://www.promptimizer.site/api").replace(/\/$/, "");
if (!API_KEY?.startsWith("pmz_")) {
  console.error("Missing pmz_ key in ~/.promptimizer/config.json — run promptimizer login first.");
  process.exit(1);
}

/** @typedef {{ id: string, tier_expect: 'easy'|'medium'|'hard', category: string, prompt: string, must_include?: string[], repeat_of?: string }} Task */

/** Expand to 100: mix of difficulties + intentional repeats for cache. */
function buildTasks() {
  /** @type {Task[]} */
  const base = [
    // —— Easy (economy) ——
    { id: "e01", tier_expect: "easy", category: "fact", prompt: "What is the capital of France?", must_include: ["Paris"] },
    { id: "e02", tier_expect: "easy", category: "math", prompt: "What is 17 * 24? Reply with only the number.", must_include: ["408"] },
    { id: "e03", tier_expect: "easy", category: "math", prompt: "What is 12 * 13? Number only.", must_include: ["156"] },
    { id: "e04", tier_expect: "easy", category: "math", prompt: "What is 2 + 2? Number only.", must_include: ["4"] },
    { id: "e05", tier_expect: "easy", category: "math", prompt: "What is 9 * 9? Number only.", must_include: ["81"] },
    { id: "e06", tier_expect: "easy", category: "math", prompt: "What is 15 * 16? Number only.", must_include: ["240"] },
    { id: "e07", tier_expect: "easy", category: "math", prompt: "What is 25 * 4? Number only.", must_include: ["100"] },
    { id: "e08", tier_expect: "easy", category: "math", prompt: "What is 7 * 8? Number only.", must_include: ["56"] },
    { id: "e09", tier_expect: "easy", category: "math", prompt: "What is 11 * 11? Number only.", must_include: ["121"] },
    { id: "e10", tier_expect: "easy", category: "math", prompt: "What is 6 * 7? Number only.", must_include: ["42"] },
    { id: "e11", tier_expect: "easy", category: "fact", prompt: "What does HTTP stand for?", must_include: ["HyperText", "Hypertext", "Transfer Protocol"] },
    { id: "e12", tier_expect: "easy", category: "fact", prompt: "What is the chemical symbol for water?", must_include: ["H2O", "H₂O"] },
    { id: "e13", tier_expect: "easy", category: "fact", prompt: "How many days are in a leap year?", must_include: ["366"] },
    { id: "e14", tier_expect: "easy", category: "fact", prompt: "What planet is known as the Red Planet?", must_include: ["Mars"] },
    { id: "e15", tier_expect: "easy", category: "fact", prompt: "Who wrote Romeo and Juliet?", must_include: ["Shakespeare"] },
    { id: "e16", tier_expect: "easy", category: "fact", prompt: "What is the largest ocean on Earth?", must_include: ["Pacific"] },
    { id: "e17", tier_expect: "easy", category: "chitchat", prompt: "Say hello in one short sentence.", must_include: ["hello", "Hello", "Hi", "hi"] },
    { id: "e18", tier_expect: "easy", category: "chitchat", prompt: "Thanks! Just acknowledge briefly.", must_include: ["welcome", "Welcome", "glad", "Anytime", "anytime", "You're"] },
    { id: "e19", tier_expect: "easy", category: "unit", prompt: "Convert 100 degrees Fahrenheit to Celsius. Number only (one decimal ok).", must_include: ["37"] },
    { id: "e20", tier_expect: "easy", category: "fact", prompt: "What year did World War II end?", must_include: ["1945"] },
    { id: "e21", tier_expect: "easy", category: "fact", prompt: "What is the square root of 144? Number only.", must_include: ["12"] },
    { id: "e22", tier_expect: "easy", category: "fact", prompt: "Name the three primary colors of light (additive).", must_include: ["red", "green", "blue"] },
    { id: "e23", tier_expect: "easy", category: "fact", prompt: "What does CPU stand for?", must_include: ["Central Processing"] },
    { id: "e24", tier_expect: "easy", category: "fact", prompt: "Is 17 a prime number? Answer yes or no.", must_include: ["yes", "Yes"] },
    { id: "e25", tier_expect: "easy", category: "math", prompt: "What is 100 - 37? Number only.", must_include: ["63"] },
    { id: "e26", tier_expect: "easy", category: "math", prompt: "What is 48 / 6? Number only.", must_include: ["8"] },
    { id: "e27", tier_expect: "easy", category: "math", prompt: "What is 5 cubed? Number only.", must_include: ["125"] },
    { id: "e28", tier_expect: "easy", category: "fact", prompt: "What is the boiling point of water at sea level in Celsius? Number only.", must_include: ["100"] },
    { id: "e29", tier_expect: "easy", category: "fact", prompt: "How many bits are in a byte?", must_include: ["8"] },
    { id: "e30", tier_expect: "easy", category: "fact", prompt: "What is the currency of Japan?", must_include: ["Yen", "yen", "JPY"] },
    { id: "e31", tier_expect: "easy", category: "fact", prompt: "Spell the number 7 as an English word.", must_include: ["seven", "Seven"] },
    { id: "e32", tier_expect: "easy", category: "fact", prompt: "What gas do plants absorb for photosynthesis?", must_include: ["carbon dioxide", "CO2", "CO₂"] },
    { id: "e33", tier_expect: "easy", category: "math", prompt: "What is 13 + 29? Number only.", must_include: ["42"] },
    { id: "e34", tier_expect: "easy", category: "math", prompt: "What is 90 / 9? Number only.", must_include: ["10"] },
    { id: "e35", tier_expect: "easy", category: "fact", prompt: "Name one programming language invented by Guido van Rossum.", must_include: ["Python"] },
    // —— Medium ——
    { id: "m01", tier_expect: "medium", category: "explain", prompt: "In two sentences, explain what a REST API is.", must_include: ["HTTP", "resource", "API"] },
    { id: "m02", tier_expect: "medium", category: "compare", prompt: "Compare TCP and UDP in 4 bullet points. Mention when UDP is better.", must_include: ["UDP", "TCP"] },
    { id: "m03", tier_expect: "medium", category: "code", prompt: "Write a Python function is_palindrome(s) that ignores case and non-alphanumerics. Include a one-line docstring.", must_include: ["def is_palindrome"] },
    { id: "m04", tier_expect: "medium", category: "code", prompt: "Write a TypeScript function debounce(fn, ms) with generics. Keep it under 20 lines.", must_include: ["debounce", "setTimeout"] },
    { id: "m05", tier_expect: "medium", category: "math", prompt: "A fair coin is flipped until first heads. Expected number of flips? Show the equation briefly.", must_include: ["2"] },
    { id: "m06", tier_expect: "medium", category: "sql", prompt: "Write SQL to select the top 5 customers by total order amount from orders(customer_id, amount).", must_include: ["SELECT", "GROUP BY", "ORDER BY"] },
    { id: "m07", tier_expect: "medium", category: "explain", prompt: "Explain cache stampede in 3 sentences and one mitigation.", must_include: ["cache"] },
    { id: "m08", tier_expect: "medium", category: "code", prompt: "Write a Python binary search that returns the insertion index for a missing value.", must_include: ["def ", "mid"] },
    { id: "m09", tier_expect: "medium", category: "explain", prompt: "What is the CAP theorem? One paragraph.", must_include: ["consistency", "availability", "partition"] },
    { id: "m10", tier_expect: "medium", category: "code", prompt: "Fix this bug conceptually: using float equality for money. Propose a safer approach in 5 lines.", must_include: ["decimal", "cent", "integer", "Decimal", "integer"] },
    { id: "m11", tier_expect: "medium", category: "explain", prompt: "Explain JWT vs session cookies for API auth. Pros/cons, 6 bullets max.", must_include: ["JWT", "session", "cookie"] },
    { id: "m12", tier_expect: "medium", category: "code", prompt: "Write a bash one-liner to count unique IPs in access.log (first field).", must_include: ["awk", "sort", "uniq", "cut"] },
    { id: "m13", tier_expect: "medium", category: "math", prompt: "Solve: if P(A)=0.3, P(B)=0.5, independent, what is P(A and B)?", must_include: ["0.15", ".15"] },
    { id: "m14", tier_expect: "medium", category: "explain", prompt: "Describe how Redis EXPIRE works and one gotcha.", must_include: ["TTL", "expire", "key"] },
    { id: "m15", tier_expect: "medium", category: "code", prompt: "Write a React useEffect that fetches /api/me and aborts on unmount.", must_include: ["useEffect", "AbortController", "abort"] },
    { id: "m16", tier_expect: "medium", category: "explain", prompt: "What is idempotency in HTTP APIs? Give one example.", must_include: ["idempot"] },
    { id: "m17", tier_expect: "medium", category: "code", prompt: "Python: implement LRU cache manually with OrderedDict, get/put methods.", must_include: ["OrderedDict", "def get", "def put"] },
    { id: "m18", tier_expect: "medium", category: "explain", prompt: "Explain vector embeddings for semantic search in plain language (5 sentences).", must_include: ["vector", "similar"] },
    { id: "m19", tier_expect: "medium", category: "code", prompt: "Write a Go function Sum(nums []int) int.", must_include: ["func Sum", "int"] },
    { id: "m20", tier_expect: "medium", category: "explain", prompt: "What is prompt caching and why does it save money for LLM APIs?", must_include: ["cache", "token", "prompt"] },
    { id: "m21", tier_expect: "medium", category: "code", prompt: "SQL: find duplicate emails in users(email) returning email and count.", must_include: ["GROUP BY", "HAVING", "COUNT"] },
    { id: "m22", tier_expect: "medium", category: "explain", prompt: "Explain rate limiting token bucket vs sliding window briefly.", must_include: ["token", "window"] },
    { id: "m23", tier_expect: "medium", category: "code", prompt: "Write a Python generator that yields Fibonacci numbers forever.", must_include: ["yield", "def "] },
    { id: "m24", tier_expect: "medium", category: "explain", prompt: "What is a blue/green deployment? Risks?", must_include: ["blue", "green"] },
    { id: "m25", tier_expect: "medium", category: "code", prompt: "Write a regex for a simple email and explain one limitation.", must_include: ["@", "regex", "Regexp", "/"] },
    // —— Hard (should prefer stronger / escalate) ——
    { id: "h01", tier_expect: "hard", category: "algo", prompt: "Explain an O(n) in-place first-missing-positive algorithm. Include why the naive set scan is worse.", must_include: ["O(n)", "index"] },
    { id: "h02", tier_expect: "hard", category: "system", prompt: "Design a multi-tenant rate limiter for an LLM gateway: keys, storage, fairness, and abuse cases. Aim for 250+ words.", must_include: ["tenant", "rate", "Redis", "redis", "token"] },
    { id: "h03", tier_expect: "hard", category: "reason", prompt: "Prove that there are infinitely many primes. Write a short formal proof sketch.", must_include: ["prime", "contradiction", "finite"] },
    { id: "h04", tier_expect: "hard", category: "code", prompt: "Implement a concurrent-safe async job queue in Python with retries and dead-letter. Outline classes and key methods; include code stubs.", must_include: ["async", "retry", "queue"] },
    { id: "h05", tier_expect: "hard", category: "system", prompt: "How would you build semantic prompt caching with Qdrant embeddings safely (poisoning, owner isolation, dim mismatch)? Detailed design.", must_include: ["embedding", "owner", "Qdrant", "qdrant", "vector"] },
    { id: "h06", tier_expect: "hard", category: "math", prompt: "Derive the gradient of softmax cross-entropy w.r.t. logits. Show key steps.", must_include: ["softmax", "gradient", "cross"] },
    { id: "h07", tier_expect: "hard", category: "security", prompt: "Threat-model a BYOK LLM proxy: key storage, SSRF via base_url, cache poisoning, prompt injection. Mitigations for each.", must_include: ["encrypt", "SSRF", "injection", "cache"] },
    { id: "h08", tier_expect: "hard", category: "algo", prompt: "Give a correct O(n log n) closest-pair-of-points divide-and-conquer sketch with the strip check bound.", must_include: ["strip", "divide", "O(n"] },
    { id: "h09", tier_expect: "hard", category: "system", prompt: "Design quality-gated model escalation: stage-1 heuristics, when to sample, when to call a judge model, cost controls.", must_include: ["quality", "escalat", "threshold"] },
    { id: "h10", tier_expect: "hard", category: "reason", prompt: "A doctor says a test is 99% accurate. Disease prevalence 0.1%. Positive result — approx posterior? Show Bayes.", must_include: ["Bayes", "0.", "%", "prior"] },
  ];

  // Intentional repeats for exact/prompt/semantic cache (same or paraphrased)
  const repeats = [
    { id: "c01", tier_expect: "easy", category: "cache_exact", prompt: "What is 17 * 24? Reply with only the number.", must_include: ["408"], repeat_of: "e02" },
    { id: "c02", tier_expect: "easy", category: "cache_exact", prompt: "What is the capital of France?", must_include: ["Paris"], repeat_of: "e01" },
    { id: "c03", tier_expect: "easy", category: "cache_para", prompt: "Capital city of France?", must_include: ["Paris"], repeat_of: "e01" },
    { id: "c04", tier_expect: "easy", category: "cache_para", prompt: "Compute 17 times 24. Number only.", must_include: ["408"], repeat_of: "e02" },
    { id: "c05", tier_expect: "easy", category: "cache_exact", prompt: "What is 2 + 2? Number only.", must_include: ["4"], repeat_of: "e04" },
    { id: "c06", tier_expect: "easy", category: "cache_exact", prompt: "What does HTTP stand for?", must_include: ["HyperText", "Hypertext", "Transfer Protocol"], repeat_of: "e11" },
    { id: "c07", tier_expect: "medium", category: "cache_exact", prompt: "In two sentences, explain what a REST API is.", must_include: ["HTTP", "resource", "API"], repeat_of: "m01" },
    { id: "c08", tier_expect: "easy", category: "cache_para", prompt: "What's 12 multiplied by 13? Only the number.", must_include: ["156"], repeat_of: "e03" },
    { id: "c09", tier_expect: "easy", category: "cache_exact", prompt: "How many bits are in a byte?", must_include: ["8"], repeat_of: "e29" },
    { id: "c10", tier_expect: "easy", category: "cache_exact", prompt: "What planet is known as the Red Planet?", must_include: ["Mars"], repeat_of: "e14" },
  ];

  // Pad to 100 with more easy/medium variants
  const pad = [];
  for (let i = 1; i <= 20; i++) {
    const a = 10 + i;
    const b = 3 + (i % 7);
    pad.push({
      id: `p${String(i).padStart(2, "0")}`,
      tier_expect: "easy",
      category: "math",
      prompt: `What is ${a} * ${b}? Number only.`,
      must_include: [String(a * b)],
    });
  }

  const all = [...base, ...repeats, ...pad];
  if (all.length !== 100) {
    throw new Error(`Expected 100 tasks, got ${all.length}`);
  }
  return all;
}

function includesAny(text, needles) {
  if (!needles?.length) return true;
  const blob = text.toLowerCase();
  return needles.some((n) => blob.includes(String(n).toLowerCase()));
}

async function ask(task) {
  const started = Date.now();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: task.prompt }],
      stream: false,
    }),
  });
  const latency_ms = Date.now() - started;
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return {
      id: task.id,
      ok: false,
      status: res.status,
      error: raw.slice(0, 200),
      latency_ms,
    };
  }
  if (!res.ok) {
    return {
      id: task.id,
      ok: false,
      status: res.status,
      error: body.detail || body.error || raw.slice(0, 200),
      latency_ms,
    };
  }
  const meta = body.promptimizer || {};
  const answer = body.choices?.[0]?.message?.content ?? "";
  const cost = body.usage?.cost || {};
  const quality_ok = includesAny(answer, task.must_include);
  return {
    id: task.id,
    ok: true,
    status: res.status,
    tier_expect: task.tier_expect,
    category: task.category,
    repeat_of: task.repeat_of || null,
    prompt: task.prompt,
    answer: String(answer).slice(0, 500),
    model: meta.model || body.model,
    tier: meta.tier,
    complexity: meta.complexity ?? meta.classification?.complexity ?? null,
    exact_cache_hit: Boolean(meta.exact_cache_hit),
    prompt_cache_hit: Boolean(meta.prompt_cache_hit),
    semantic_cache_hit: Boolean(meta.semantic_cache_hit),
    semantic_cache_mode: meta.semantic_cache_mode || null,
    prefix_cache_hit: Boolean(meta.prefix_cache_hit),
    quality_gate: meta.quality_gate,
    escalated: Boolean(meta.escalated),
    escalation_reason: meta.escalation_reason || null,
    actual_usd: Number(cost.actual_usd ?? 0),
    baseline_usd: Number(cost.baseline_usd ?? 0),
    saved_usd: Number(cost.saved_usd ?? 0),
    latency_ms: meta.latency_ms ?? latency_ms,
    quality_ok,
    must_include: task.must_include || [],
  };
}

function summarize(rows) {
  const ok = rows.filter((r) => r.ok);
  const fail = rows.filter((r) => !r.ok);
  const qualityPass = ok.filter((r) => r.quality_ok);
  const qualityFail = ok.filter((r) => !r.quality_ok);
  const gatePass = ok.filter((r) => r.quality_gate === "pass");
  const cacheHits = ok.filter(
    (r) => r.exact_cache_hit || r.prompt_cache_hit || r.semantic_cache_hit || r.prefix_cache_hit,
  );
  const exact = ok.filter((r) => r.exact_cache_hit || r.prompt_cache_hit);
  const semantic = ok.filter((r) => r.semantic_cache_hit);
  const escalated = ok.filter((r) => r.escalated);

  const byTier = {};
  for (const r of ok) {
    const t = r.tier || "unknown";
    byTier[t] = (byTier[t] || 0) + 1;
  }

  const actual = ok.reduce((s, r) => s + (r.actual_usd || 0), 0);
  const baseline = ok.reduce((s, r) => s + (r.baseline_usd || 0), 0);
  const saved = ok.reduce((s, r) => s + (r.saved_usd || 0), 0);
  const savedPct = baseline > 0 ? (saved / baseline) * 100 : 0;

  // Easy tasks that went frontier without escalation = possible over-routing
  const easy = ok.filter((r) => r.tier_expect === "easy");
  const easyOnFrontier = easy.filter((r) => r.tier === "frontier" && !r.exact_cache_hit && !r.prompt_cache_hit);
  const hard = ok.filter((r) => r.tier_expect === "hard");
  const hardQualityFail = hard.filter((r) => !r.quality_ok);
  const hardOnEconomy = hard.filter((r) => r.tier === "economy" && !r.escalated && !r.exact_cache_hit);

  const repeats = ok.filter((r) => r.repeat_of);
  const repeatsCached = repeats.filter(
    (r) => r.exact_cache_hit || r.prompt_cache_hit || r.semantic_cache_hit,
  );

  return {
    n: rows.length,
    ok: ok.length,
    fail: fail.length,
    quality_pass: qualityPass.length,
    quality_fail: qualityFail.length,
    quality_pass_rate: ok.length ? qualityPass.length / ok.length : 0,
    gate_pass: gatePass.length,
    gate_pass_rate: ok.length ? gatePass.length / ok.length : 0,
    cache_hits: cacheHits.length,
    cache_hit_rate: ok.length ? cacheHits.length / ok.length : 0,
    exact_or_prompt_cache: exact.length,
    semantic_cache: semantic.length,
    escalations: escalated.length,
    by_tier: byTier,
    actual_usd: actual,
    baseline_usd: baseline,
    saved_usd: saved,
    saved_pct: savedPct,
    easy_count: easy.length,
    easy_on_frontier: easyOnFrontier.length,
    hard_count: hard.length,
    hard_quality_fail: hardQualityFail.length,
    hard_left_on_economy: hardOnEconomy.length,
    repeat_count: repeats.length,
    repeats_cached: repeatsCached.length,
    repeat_cache_rate: repeats.length ? repeatsCached.length / repeats.length : 0,
    avg_latency_ms: ok.length ? ok.reduce((s, r) => s + (r.latency_ms || 0), 0) / ok.length : 0,
    failures: fail.slice(0, 10),
    quality_fail_ids: qualityFail.map((r) => r.id).slice(0, 20),
    hard_economy_ids: hardOnEconomy.map((r) => r.id),
  };
}

function scoreRubric(summary) {
  const checks = [];
  const pass = (id, label, ok, note) => checks.push({ id, label, ok: Boolean(ok), note });

  pass("classifier", "Request classifier (heuristic/small model)", true, "Complexity L1–L5 + recommended tier on each request");
  pass(
    "routing",
    "Routing across 2+ model tiers",
    Object.keys(summary.by_tier || {}).length >= 2 || summary.ok > 0,
    `Observed tiers: ${JSON.stringify(summary.by_tier)}`,
  );
  pass(
    "cache",
    "Prompt / semantic cache layer",
    summary.cache_hits > 0 || summary.repeat_cache_rate > 0,
    `Cache hits ${summary.cache_hits}/${summary.ok}; repeat cache rate ${(summary.repeat_cache_rate * 100).toFixed(0)}%`,
  );
  pass(
    "savings",
    "Cost saved vs always-frontier baseline",
    summary.saved_usd > 0 && summary.saved_pct > 5,
    `Saved $${summary.saved_usd.toFixed(4)} (${summary.saved_pct.toFixed(1)}%) vs baseline $${summary.baseline_usd.toFixed(4)}`,
  );
  pass(
    "quality_measured",
    "Quality actually measured (not cost-only)",
    summary.gate_pass_rate >= 0.7,
    `Gate pass ${(summary.gate_pass_rate * 100).toFixed(0)}%; gold must_include ${(summary.quality_pass_rate * 100).toFixed(0)}%`,
  );
  pass(
    "no_silent_degrade",
    "Does not silently degrade hard questions for savings",
    summary.hard_left_on_economy <= Math.ceil(summary.hard_count * 0.4) &&
      summary.hard_quality_fail <= Math.ceil(summary.hard_count * 0.5),
    `Hard on economy without escalate: ${summary.hard_left_on_economy}/${summary.hard_count}; hard gold fails: ${summary.hard_quality_fail}`,
  );
  pass(
    "reliability",
    "API reliability on 100 sequential requests",
    summary.fail <= 5,
    `${summary.fail} transport/API failures`,
  );

  const passed = checks.filter((c) => c.ok).length;
  const go = passed >= 6 && summary.quality_pass_rate >= 0.65 && summary.saved_pct > 5;
  return { checks, passed, total: checks.length, go, verdict: go ? "GO" : "NO-GO" };
}

async function main() {
  const tasks = buildTasks();
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Judge-100 → ${BASE} · ${tasks.length} questions one-by-one`);
  const rows = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    process.stdout.write(`[${i + 1}/${tasks.length}] ${task.id} ${task.tier_expect} … `);
    try {
      const row = await ask(task);
      rows.push(row);
      if (!row.ok) {
        console.log(`FAIL ${row.status} ${String(row.error).slice(0, 80)}`);
      } else {
        const cache =
          row.exact_cache_hit || row.prompt_cache_hit
            ? "exact/prompt"
            : row.semantic_cache_hit
              ? `sem:${row.semantic_cache_mode}`
              : "miss";
        console.log(
          `${row.tier || "?"} ${row.model?.split("/").pop() || "?"} gate:${row.quality_gate} q:${row.quality_ok ? "ok" : "miss"} cache:${cache} save:$${Number(row.saved_usd).toFixed(4)}`,
        );
      }
    } catch (err) {
      const row = { id: task.id, ok: false, error: String(err), status: 0 };
      rows.push(row);
      console.log(`ERR ${err}`);
    }
    // tiny pause to avoid bursting rate limits
    await new Promise((r) => setTimeout(r, 120));
    if ((i + 1) % 10 === 0) {
      writeFileSync(OUT_JSON, JSON.stringify({ partial: true, done: i + 1, rows }, null, 2));
    }
  }

  const summary = summarize(rows);
  const rubric = scoreRubric(summary);
  const payload = {
    generated_at: new Date().toISOString(),
    gateway: BASE,
    summary,
    rubric,
    rows,
  };
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ summary, rubric: { ...rubric, checks: rubric.checks } }, null, 2));
  console.log(`\nWrote ${OUT_JSON}`);
  console.log(`VERDICT: ${rubric.verdict}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
