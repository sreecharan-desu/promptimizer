import { classifyText, type Classification } from "promptimizer";
import { BENCHMARK, PRICING } from "./data";

export type Tier = "economy" | "standard" | "frontier";

export type ModelInfo = {
  id: string;
  owned_by: string;
  input_per_1m: number | null;
  output_per_1m: number | null;
  tier: Tier;
  source: string;
  selected: boolean;
};

export type Session = {
  id: string;
  mode: "mock" | "byok";
  label: string;
  base_url: string;
  api_key: string;
  models: ModelInfo[];
  baseline_model: string | null;
  created_at: number;
  stats: Record<string, number>;
};

const store = new Map<string, Session>();
const prefixSeen = new Set<string>();
const exactCache = new Map<string, unknown>();

const TIER_ORDER: Tier[] = ["economy", "standard", "frontier"];

function id() {
  return `sess_${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

function lookupPrice(modelId: string) {
  if (PRICING[modelId]) return PRICING[modelId];
  const hit = Object.entries(PRICING).find(([key]) => modelId.toLowerCase().includes(key));
  return hit?.[1];
}

function inferTier(modelId: string): { tier: Tier; source: string } {
  const priced = lookupPrice(modelId);
  if (priced?.tier) return { tier: priced.tier as Tier, source: "catalog" };
  if (/(mini|nano|haiku|tiny|lite|instant|8b|7b|small)/i.test(modelId)) return { tier: "economy", source: "heuristic" };
  if (/(gpt-4(?!o-mini|\.1-mini)|opus|o1$|o3$|405b|frontier)/i.test(modelId)) return { tier: "frontier", source: "heuristic" };
  if (/(sonnet|flash|70b|72b|o1-mini|reasoner)/i.test(modelId)) return { tier: "standard", source: "heuristic" };
  return { tier: "standard", source: "heuristic" };
}

function blend(model: ModelInfo) {
  return (model.input_per_1m ?? 2) * 0.4 + (model.output_per_1m ?? 6) * 0.6;
}

function cheapest(models: ModelInfo[], tier?: Tier) {
  const pool = models.filter((m) => m.selected && (!tier || m.tier === tier));
  return pool.sort((a, b) => blend(a) - blend(b))[0];
}

function fleetFrom(raw: Array<{ id?: string; name?: string; owned_by?: string }>): ModelInfo[] {
  return raw
    .map((item) => item.id ?? item.name ?? "")
    .filter((mid) => mid && !/(embed|whisper|tts|dall|image|moderation)/i.test(mid))
    .filter((mid, i, arr) => arr.indexOf(mid) === i)
    .map((mid) => {
      const priced = lookupPrice(mid);
      const { tier, source } = inferTier(mid);
      return {
        id: mid,
        owned_by: "provider",
        input_per_1m: priced?.input ?? null,
        output_per_1m: priced?.output ?? null,
        tier,
        source,
        selected: true,
      };
    })
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || blend(a) - blend(b));
}

function publicSession(session: Session) {
  return {
    session_id: session.id,
    mode: session.mode,
    label: session.label,
    base_url: session.base_url,
    models: session.models,
    baseline_model: session.baseline_model,
    stats: session.stats,
    created_at: session.created_at,
  };
}

export function getSession(sessionId: string | null) {
  if (!sessionId) return null;
  return store.get(sessionId) ?? null;
}

export function createMockSession(label = "Promptimizer simulator") {
  const models = fleetFrom([
    { id: "promptimizer-nano" },
    { id: "promptimizer-flash" },
    { id: "promptimizer-frontier" },
  ]);
  const session: Session = {
    id: id(),
    mode: "mock",
    label,
    base_url: "mock://promptimizer",
    api_key: "",
    models,
    baseline_model: "promptimizer-frontier",
    created_at: Date.now() / 1000,
    stats: { requests: 0, actual_usd: 0, baseline_usd: 0, saved_usd: 0, cache_hits: 0, escalations: 0, quality_fails: 0 },
  };
  store.set(session.id, session);
  return publicSession(session);
}

export async function createByokSession(input: { label?: string; base_url: string; api_key: string }) {
  const response = await fetch(`${input.base_url.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${input.api_key}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Provider rejected the key (${response.status})`), { status: response.status });
  }
  const payload = await response.json();
  const raw = Array.isArray(payload) ? payload : payload.data ?? [];
  const models = fleetFrom(raw);
  if (!models.length) throw Object.assign(new Error("No chat models found."), { status: 400 });
  const frontier = cheapest(models, "frontier") ?? models[models.length - 1];
  const session: Session = {
    id: id(),
    mode: "byok",
    label: input.label ?? "BYOK",
    base_url: input.base_url.replace(/\/$/, ""),
    api_key: input.api_key,
    models,
    baseline_model: frontier.id,
    created_at: Date.now() / 1000,
    stats: { requests: 0, actual_usd: 0, baseline_usd: 0, saved_usd: 0, cache_hits: 0, escalations: 0, quality_fails: 0 },
  };
  store.set(session.id, session);
  return publicSession(session);
}

export function patchFleet(
  session: Session,
  body: { overrides?: Record<string, string>; selected?: Record<string, boolean>; baseline_model?: string },
) {
  for (const model of session.models) {
    const next = body.overrides?.[model.id];
    if (next === "economy" || next === "standard" || next === "frontier") {
      model.tier = next;
      model.source = "user";
    }
    if (body.selected && model.id in body.selected) model.selected = Boolean(body.selected[model.id]);
  }
  if (body.baseline_model) session.baseline_model = body.baseline_model;
  return publicSession(session);
}

function tokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

function costOf(routed: ModelInfo, baseline: ModelInfo, promptTokens: number, completionTokens: number, cachedTokens: number) {
  const rin = routed.input_per_1m ?? 1;
  const rout = routed.output_per_1m ?? 3;
  const bin = baseline.input_per_1m ?? 5;
  const bout = baseline.output_per_1m ?? 15;
  const cached = Math.min(cachedTokens, promptTokens);
  const actual =
    ((promptTokens - cached) / 1e6) * rin + (cached / 1e6) * rin * 0.5 + (completionTokens / 1e6) * rout;
  const baselineUsd = (promptTokens / 1e6) * bin + (completionTokens / 1e6) * bout;
  const saved = Math.max(0, baselineUsd - actual);
  return {
    actual_usd: actual,
    baseline_usd: baselineUsd,
    saved_usd: saved,
    saved_pct: baselineUsd ? (saved / baselineUsd) * 100 : 0,
    cache_discount_usd: (cached / 1e6) * rin * 0.5,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cached_tokens: cached,
  };
}

function scoreAnswer(pred: string, gold: string, must: string[], difficulty: number) {
  const blob = pred.toLowerCase();
  const coverage = must.length ? must.filter((n) => blob.includes(n.toLowerCase())).length / must.length : 1;
  const thin = difficulty >= 4 && pred.trim().length < 80;
  const refusal = /i don't know|too complex|as a small model/.test(blob);
  const structure = pred.length > 80 ? 0.8 : 0.4;
  const score = 0.55 * coverage + 0.45 * structure;
  const degraded = thin || refusal || score < 0.62;
  return { score, coverage, structure, degraded, notes: degraded ? ["below quality bar"] : [] };
}

function pick(session: Session, classification: Classification, hint?: string) {
  if (hint && hint !== "auto" && hint !== "promptimizer") {
    const found = session.models.find((m) => m.id === hint);
    if (found) return found;
  }
  const start = TIER_ORDER.indexOf(classification.recommended_tier);
  for (const tier of TIER_ORDER.slice(start)) {
    const model = cheapest(session.models, tier);
    if (model) return model;
  }
  return cheapest(session.models);
}

function mockAnswer(model: string, prompt: string, classification: Classification) {
  const hard = classification.complexity >= 4 || classification.quality_risk === "high";
  if (model.endsWith("nano") && hard) {
    return "This looks too complex for the economy model. I don't know how to give a complete, reliable answer.";
  }
  if (model.endsWith("flash") && classification.complexity >= 5) {
    return "I can outline this, but as a small model I may miss failure modes. A frontier model should review the design.";
  }
  const table: Array<[RegExp, string]> = [
    [/capital of france/i, "Paris is the capital of France."],
    [/fahrenheit/i, "37.8"],
    [/http stand/i, "HyperText Transfer Protocol"],
    [/17 \* 24|17\*24/i, "408"],
    [/rest api/i, "A REST API is an HTTP interface that exposes resources through uniform methods. Clients send stateless requests."],
    [/merge_sorted/i, 'def merge_sorted(a, b):\n    """Merge two sorted lists in linear time."""\n    i = j = 0\n    out = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    out.extend(a[i:]); out.extend(b[j:])\n    return out'],
    [/tcp and udp/i, "TCP is reliable and ordered; UDP is connectionless and lower latency. UDP is better for live video, DNS, and multiplayer game state."],
    [/expected number of flips/i, "Let E be expected flips. E = 1 + (1/2)E, so E = 2."],
    [/despliegue|secreto de la base/i, "The deployment failed because the database secret was not mounted into the pod."],
    [/rate limiter/i, "Use a distributed token bucket: each edge holds a local slice of tokens, replenished from a Redis cluster with sliding-window fallback. Accept eventual consistency on refill."],
    [/infinitely many prime/i, "Euclid: if p1..pk were all primes, N = p1..pk + 1 has a new prime factor — contradiction. Twin primes are pairs; the same construction does not produce a pair with difference 2."],
    [/goroutine/i, "Go maps are not goroutine-safe; concurrent writes race and can panic. Protect with a mutex, or shard maps by key hash."],
    [/cut LLM cost|refunds, legal/i, "Classify tickets by risk and route FAQ to economy, refunds/legal/medical to frontier. Keep a gold eval set so silent quality regressions auto-escalate."],
    [/peeking/i, "Daily peeking inflates Type I error; p=0.048 is not valid. Use sequential testing or a pre-registered sample. Multiple comparisons need correction."],
    [/first missing/i, "The given code is O(n^2) because membership scans the list. Place each value v at index v-1, then scan for the first mismatch — O(n) time."],
  ];
  for (const [re, value] of table) if (re.test(prompt)) return value;
  return prompt.slice(0, 220);
}

async function complete(session: Session, model: string, messages: Array<{ role: string; content: string }>, classification: Classification) {
  const prompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (session.mode === "mock") {
    const text = mockAnswer(model, prompt, classification);
    return {
      id: `chatcmpl-mock-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: tokens(JSON.stringify(messages)),
        completion_tokens: tokens(text),
        total_tokens: tokens(JSON.stringify(messages)) + tokens(text),
      },
    };
  }
  const response = await fetch(`${session.base_url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(await response.text()), { status: response.status });
  }
  return response.json();
}

export async function routeChat(
  session: Session,
  body: { messages: Array<{ role: string; content: string }>; model?: string; level_override?: number },
) {
  const prompt = body.messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const classification = body.level_override
    ? {
        ...classifyText(prompt),
        complexity: body.level_override,
        recommended_tier: (body.level_override >= 4 ? "frontier" : body.level_override === 3 ? "standard" : "economy") as Tier,
      }
    : classifyText(prompt);

  let routed = pick(session, classification, body.model);
  if (!routed) throw Object.assign(new Error("No selected models."), { status: 400 });
  const baseline = session.models.find((m) => m.id === session.baseline_model) ?? routed;

  const system = body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const prefixKey = system.slice(0, 800);
  const prefixHit = prefixKey.length >= 40 && prefixSeen.has(prefixKey);
  if (prefixKey.length >= 40) prefixSeen.add(prefixKey);

  const exactKey = JSON.stringify({ m: body.messages, model: routed.id });
  let payload = exactCache.get(exactKey) as Awaited<ReturnType<typeof complete>> | undefined;
  const exactHit = Boolean(payload);
  if (!payload) {
    payload = await complete(session, routed.id, body.messages, classification);
    exactCache.set(exactKey, payload);
  }

  let escalated = false;
  const text = payload.choices?.[0]?.message?.content ?? "";
  if (!exactHit && /i don't know|too complex|as a small model/.test(text.toLowerCase())) {
    const nextTier = TIER_ORDER[TIER_ORDER.indexOf(routed.tier) + 1];
    const upgrade = nextTier ? cheapest(session.models, nextTier) : undefined;
    if (upgrade) {
      escalated = true;
      routed = upgrade;
      payload = await complete(session, routed.id, body.messages, classification);
    }
  }

  const promptTokens = payload.usage?.prompt_tokens ?? tokens(prompt);
  const completionTokens = payload.usage?.completion_tokens ?? tokens(text);
  const cost = costOf(routed, baseline, promptTokens, completionTokens, prefixHit ? tokens(prefixKey) : 0);
  const quality = scoreAnswer(payload.choices?.[0]?.message?.content ?? "", "", [], classification.complexity);

  session.stats.requests += 1;
  session.stats.actual_usd += cost.actual_usd;
  session.stats.baseline_usd += cost.baseline_usd;
  session.stats.saved_usd += cost.saved_usd;
  session.stats.cache_hits += exactHit || prefixHit ? 1 : 0;
  session.stats.escalations += escalated ? 1 : 0;
  session.stats.quality_fails += quality.degraded ? 1 : 0;

  return {
    ...payload,
    model: routed.id,
    usage: { ...payload.usage, prompt_tokens: promptTokens, completion_tokens: completionTokens, cost },
    promptimizer: {
      session_id: session.id,
      complexity: classification.complexity,
      category: classification.category,
      confidence: classification.confidence,
      tier: routed.tier,
      model: routed.id,
      baseline_model: baseline.id,
      cache_hit: exactHit || prefixHit,
      prefix_cache_hit: prefixHit,
      exact_cache_hit: exactHit,
      escalated,
      quality_gate: quality.degraded ? "fail" : "pass",
      quality,
      rationale: classification.rationale,
    },
  };
}

export async function runBenchmark(session: Session) {
  const rows = [];
  const totals = { actual_usd: 0, baseline_usd: 0, saved_usd: 0, routed_quality: 0, frontier_quality: 0, escalations: 0, cache_hits: 0, quality_fails: 0 };
  for (const task of BENCHMARK) {
    const routed = await routeChat(session, { messages: [{ role: "user", content: task.prompt }] });
    const answer = routed.choices[0].message.content;
    const qRouted = scoreAnswer(answer, task.gold, task.must_include, task.difficulty);
    const frontier = await routeChat(session, {
      messages: [{ role: "user", content: task.prompt }],
      model: session.baseline_model ?? undefined,
    });
    const qFrontier = scoreAnswer(frontier.choices[0].message.content, task.gold, task.must_include, task.difficulty);
    const cost = routed.usage.cost!;
    totals.actual_usd += cost.actual_usd;
    totals.baseline_usd += cost.baseline_usd;
    totals.saved_usd += cost.saved_usd;
    totals.routed_quality += qRouted.score;
    totals.frontier_quality += qFrontier.score;
    totals.escalations += routed.promptimizer.escalated ? 1 : 0;
    totals.cache_hits += routed.promptimizer.cache_hit ? 1 : 0;
    totals.quality_fails += qRouted.degraded ? 1 : 0;
    rows.push({
      id: task.id,
      difficulty: task.difficulty,
      category: task.category,
      prompt: task.prompt,
      model: routed.promptimizer.model,
      tier: routed.promptimizer.tier,
      complexity: routed.promptimizer.complexity,
      escalated: routed.promptimizer.escalated,
      cost,
      quality_routed: qRouted,
      quality_frontier: qFrontier,
      quality_delta: qRouted.score - qFrontier.score,
      answer,
      frontier_answer: frontier.choices[0].message.content,
    });
  }
  const n = rows.length;
  return {
    name: "Promptimizer Fixed Task Set",
    tasks: n,
    summary: {
      actual_usd: totals.actual_usd,
      baseline_usd: totals.baseline_usd,
      saved_usd: totals.saved_usd,
      saved_pct: totals.baseline_usd ? (totals.saved_usd / totals.baseline_usd) * 100 : 0,
      avg_quality_routed: totals.routed_quality / n,
      avg_quality_frontier: totals.frontier_quality / n,
      quality_delta: (totals.routed_quality - totals.frontier_quality) / n,
      escalations: totals.escalations,
      cache_hits: totals.cache_hits,
      quality_fails: totals.quality_fails,
    },
    rows,
    session: publicSession(session),
  };
}

export { publicSession };
