import { classifyText, difficultyTier, type Classification } from "promptimizer";
import { BENCHMARK, PRICING } from "./data";
import { cacheGet, cacheRemember, cacheSet } from "./upstash";
import {
  buildHybridMessages,
  findSimilar,
  rememberSemantic,
  type SemanticMatch,
} from "./semantic-cache";
import { qualityGuardEnabled, nextRequestOrdinal, runQualityGate, shouldRunAccuracyAudit } from "./quality-gate";
import { scoreAnswerLike } from "./quality-gate-score";
import {
  aggregateQualityProfiles,
  buildPricing,
  chooseModel,
  estimateContextLength,
  estimatePricingPer1m,
  extractRequirements,
  normalizeModel,
  type ModelProfile,
  type ModelQualityProfile,
  type RoutingDecision,
} from "./optimizer";

export type Tier = "economy" | "standard" | "frontier";

export type ProviderConnection = {
  id: string;
  label: string;
  base_url: string;
  api_key: string;
};

export type ModelInfo = {
  id: string;
  owned_by: string;
  input_per_1m: number | null;
  output_per_1m: number | null;
  tier: Tier;
  source: string;
  selected: boolean;
  provider_id: string;
  provider_label?: string;
  context_length?: number | null;
  max_completion_tokens?: number | null;
  pricing_known?: boolean;
  pricing_source?: "catalog" | "provider" | "estimate" | "unknown";
  supported_features?: string[];
  input_modalities?: string[];
  description?: string | null;
  overall_quality?: number | null;
};

export type Session = {
  id: string;
  mode: "mock" | "byok";
  label: string;
  base_url: string;
  api_key: string;
  connections: ProviderConnection[];
  models: ModelInfo[];
  baseline_model: string | null;
  created_at: number;
  stats: Record<string, number>;
};

const store = new Map<string, Session>();

const TIER_ORDER: Tier[] = ["economy", "standard", "frontier"];

function id() {
  return `sess_${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
}

function lookupPrice(modelId: string) {
  if (PRICING[modelId]) return PRICING[modelId];
  const lower = modelId.toLowerCase();
  const short = lower.includes("/") ? lower.split("/").pop()! : lower;
  const exact = Object.entries(PRICING).find(([key]) => {
    const k = key.toLowerCase();
    return k === lower || k === short || k.endsWith(`/${short}`) || short.endsWith(k);
  });
  if (exact) return exact[1];
  // Prefer longest catalog key contained in the model id (avoids weak short matches).
  const contained = Object.entries(PRICING)
    .filter(([key]) => key.length >= 6 && lower.includes(key.toLowerCase()))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return contained?.[1];
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
  const inn = model.input_per_1m ?? lookupPrice(model.id)?.input ?? 2;
  const out = model.output_per_1m ?? lookupPrice(model.id)?.output ?? 6;
  return inn * 0.4 + out * 0.6;
}

function enrichModel(model: ModelInfo, labelByProvider?: Map<string, string>): ModelInfo {
  const priced = lookupPrice(model.id);
  const providerId = model.provider_id || "provider";
  const providerLabel =
    model.provider_label || labelByProvider?.get(providerId) || providerId;
  let input = model.input_per_1m ?? priced?.input ?? null;
  let output = model.output_per_1m ?? priced?.output ?? null;
  let pricingSource = model.pricing_source;
  let pricingKnown = model.pricing_known;
  if (input == null || output == null) {
    const est = estimatePricingPer1m(model.id);
    input = input ?? est.input;
    output = output ?? est.output;
    pricingSource = pricingSource ?? "estimate";
    pricingKnown = false;
  } else if (!pricingSource) {
    pricingSource = priced ? "catalog" : model.pricing_known ? "provider" : "unknown";
  }
  const context = model.context_length ?? estimateContextLength(model.id);
  return {
    ...model,
    provider_id: providerId,
    provider_label: providerLabel,
    input_per_1m: input,
    output_per_1m: output,
    context_length: context,
    pricing_known: pricingKnown ?? Boolean(priced),
    pricing_source: pricingSource,
  };
}

function cheapest(models: ModelInfo[], tier?: Tier) {
  const pool = models.filter((m) => m.selected && (!tier || m.tier === tier));
  return pool.sort((a, b) => blend(a) - blend(b))[0];
}

function fleetFrom(
  raw: Array<Record<string, unknown>>,
  providerId = "provider",
  providerLabel = providerId,
): ModelInfo[] {
  const models: ModelInfo[] = [];
  for (const item of raw) {
    const mid = String(item.id ?? item.name ?? "");
    if (!mid || /(embed|whisper|tts|dall|image|moderation)/i.test(mid)) continue;
    if (models.some((m) => m.id === mid)) continue;
    const priced = lookupPrice(mid);
    const { tier, source } = inferTier(mid);
    const profile = normalizeModel(item as Parameters<typeof normalizeModel>[0], providerId, priced);
    let input = profile.pricing?.prompt
      ? profile.pricing.prompt.usd_per_token * 1_000_000
      : priced?.input ?? null;
    let output = profile.pricing?.completion
      ? profile.pricing.completion.usd_per_token * 1_000_000
      : priced?.output ?? null;
    let pricingSource: ModelInfo["pricing_source"] = priced
      ? "catalog"
      : profile.pricing?.known
        ? "provider"
        : "unknown";
    let pricingKnown = Boolean(profile.pricing?.known || priced);
    if (input == null || output == null) {
      const est = estimatePricingPer1m(mid);
      input = input ?? est.input;
      output = output ?? est.output;
      pricingSource = "estimate";
      pricingKnown = false;
    }
    models.push({
      id: mid,
      owned_by: String(item.owned_by ?? providerId),
      input_per_1m: input,
      output_per_1m: output,
      tier,
      source: pricingSource === "provider" ? "provider" : source,
      selected: true,
      provider_id: providerId,
      provider_label: providerLabel,
      context_length: profile.context_length ?? estimateContextLength(mid),
      max_completion_tokens: profile.max_completion_tokens,
      pricing_known: pricingKnown,
      pricing_source: pricingSource,
      supported_features: profile.supported_features,
      input_modalities: profile.input_modalities,
      description: profile.description,
      overall_quality: null,
    });
  }
  return models.sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || blend(a) - blend(b),
  );
}

function toProfile(model: ModelInfo, providerId = "provider"): ModelProfile {
  return {
    provider_id: model.provider_id || providerId,
    model_id: model.id,
    display_name: model.id,
    description: model.description ?? null,
    context_length: model.context_length ?? null,
    max_completion_tokens: model.max_completion_tokens ?? null,
    pricing: buildPricing({
      prompt_per_1m: model.input_per_1m,
      completion_per_1m: model.output_per_1m,
    }),
    supported_features: model.supported_features ?? [],
    supported_sampling_parameters: [],
    input_modalities: model.input_modalities?.length ? model.input_modalities : ["text"],
    output_modalities: ["text"],
  };
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/$/, "").toLowerCase();
}

function connectionIdFor(baseUrl: string, providerKey?: string) {
  if (providerKey?.trim()) return providerKey.trim().toLowerCase();
  return normalizeBaseUrl(baseUrl).replace(/^https?:\/\//, "");
}

/** Drop duplicate hosts (same base URL / id) and duplicate model rows. */
function dedupeFleet(session: Session) {
  const byBase = new Map<string, ProviderConnection>();
  for (const c of session.connections) {
    const key = normalizeBaseUrl(c.base_url) || c.id;
    const prev = byBase.get(key);
    if (!prev) byBase.set(key, c);
    else {
      // Prefer canonical provider id (short) over URL-slug ids.
      if (c.id.length < prev.id.length) byBase.set(key, c);
    }
  }
  session.connections = [...byBase.values()];
  const idByBase = new Map(session.connections.map((c) => [normalizeBaseUrl(c.base_url), c.id]));
  const unique = new Map<string, ModelInfo>();
  for (const m of session.models) {
    const conn = session.connections.find((c) => c.id === m.provider_id);
    const providerId =
      conn?.id ??
      idByBase.get(normalizeBaseUrl(m.provider_id)) ??
      m.provider_id;
    const key = `${providerId}::${m.id}`;
    if (!unique.has(key)) {
      unique.set(key, {
        ...m,
        provider_id: providerId,
        provider_label: conn?.label ?? m.provider_label ?? providerId,
      });
    }
  }
  session.models = [...unique.values()].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || blend(a) - blend(b),
  );
  refreshSessionLabel(session);
}

function refreshSessionLabel(session: Session) {
  if (session.mode === "mock") {
    session.label = "Promptimizer simulator";
    return;
  }
  const labels = session.connections.map((c) => c.label);
  session.label = labels.length ? labels.join(" + ") : "BYOK";
  const primary = session.connections[0];
  if (primary) {
    session.base_url = primary.base_url;
    session.api_key = primary.api_key;
  }
}

function pickBaseline(models: ModelInfo[]) {
  return cheapest(models, "frontier") ?? models[models.length - 1] ?? null;
}

function publicSession(session: Session) {
  const labelByProvider = new Map(session.connections.map((c) => [c.id, c.label]));
  return {
    session_id: session.id,
    mode: session.mode,
    label: session.label,
    base_url: session.base_url,
    connections: session.connections.map((c) => ({
      id: c.id,
      label: c.label,
      base_url: c.base_url,
    })),
    models: session.models.map((m) => enrichModel(m, labelByProvider)),
    baseline_model: session.baseline_model,
    stats: session.stats,
    created_at: session.created_at,
  };
}

export function getSession(sessionId: string | null) {
  if (!sessionId) return null;
  return store.get(sessionId) ?? null;
}

function emptyStats() {
  return { requests: 0, actual_usd: 0, baseline_usd: 0, saved_usd: 0, cache_hits: 0, escalations: 0, quality_fails: 0 };
}

export function accountSessionId(userId: string) {
  return `acct_${userId}`;
}

export function createMockSession(label = "Promptimizer simulator", sessionId?: string) {
  const models = fleetFrom(
    [{ id: "promptimizer-nano" }, { id: "promptimizer-flash" }, { id: "promptimizer-frontier" }],
    "simulator",
    "Simulator",
  );
  const session: Session = {
    id: sessionId ?? id(),
    mode: "mock",
    label,
    base_url: "mock://promptimizer",
    api_key: "",
    connections: [],
    models,
    baseline_model: "promptimizer-frontier",
    created_at: Date.now() / 1000,
    stats: emptyStats(),
  };
  store.set(session.id, session);
  return publicSession(session);
}

export async function createByokSession(
  input: { label?: string; base_url: string; api_key: string; provider?: string },
  sessionId?: string,
) {
  const base = normalizeBaseUrl(input.base_url);
  const connId = connectionIdFor(base, input.provider);
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${input.api_key}` },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Provider rejected the key (${response.status})`), { status: response.status });
  }
  const payload = await response.json();
  const raw = (Array.isArray(payload) ? payload : payload.data ?? []) as Array<Record<string, unknown>>;
  const hostLabel = input.label?.trim() || input.provider?.trim() || connId;
  const incoming = fleetFrom(raw, connId, hostLabel);
  if (!incoming.length) throw Object.assign(new Error("No chat models found."), { status: 400 });

  const existing = sessionId ? store.get(sessionId) : undefined;
  const mergeInto =
    existing && existing.mode === "byok"
      ? existing
      : ({
          id: sessionId ?? id(),
          mode: "byok" as const,
          label: hostLabel,
          base_url: base,
          api_key: input.api_key,
          connections: [] as ProviderConnection[],
          models: [] as ModelInfo[],
          baseline_model: null as string | null,
          created_at: Date.now() / 1000,
          stats: emptyStats(),
        } satisfies Session);

  const replacedIds = new Set(
    mergeInto.connections
      .filter((c) => c.id === connId || normalizeBaseUrl(c.base_url) === base)
      .map((c) => c.id),
  );
  replacedIds.add(connId);

  const connection: ProviderConnection = {
    id: connId,
    label: hostLabel,
    base_url: base,
    api_key: input.api_key,
  };
  mergeInto.connections = [
    ...mergeInto.connections.filter((c) => !replacedIds.has(c.id) && normalizeBaseUrl(c.base_url) !== base),
    connection,
  ];
  mergeInto.models = [
    ...mergeInto.models.filter((m) => !replacedIds.has(m.provider_id)),
    ...incoming,
  ];
  mergeInto.mode = "byok";
  dedupeFleet(mergeInto);
  const baseline = pickBaseline(mergeInto.models);
  mergeInto.baseline_model = baseline?.id ?? null;
  store.set(mergeInto.id, mergeInto);
  return publicSession(mergeInto);
}

/** Remove one host from a multi-provider fleet. Needle matches id, label, or base URL. */
export function disconnectProvider(session: Session, needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) {
    throw Object.assign(new Error("Provide a host id (e.g. baseten) or label."), { status: 400 });
  }
  if (session.mode === "mock") {
    throw Object.assign(new Error("Simulator has no removable hosts. Connect a BYOK provider first."), {
      status: 400,
    });
  }
  const conn = session.connections.find(
    (c) =>
      c.id.toLowerCase() === n ||
      c.label.toLowerCase() === n ||
      c.base_url.toLowerCase().includes(n) ||
      c.label.toLowerCase().replace(/\s+/g, "") === n.replace(/\s+/g, ""),
  );
  if (!conn) {
    const known = session.connections.map((c) => c.id).join(", ") || "(none)";
    throw Object.assign(new Error(`Host "${needle}" not connected. Connected: ${known}`), { status: 404 });
  }

  session.connections = session.connections.filter((c) => c.id !== conn.id);
  session.models = session.models.filter((m) => m.provider_id !== conn.id);

  if (!session.connections.length) {
    return { session: createMockSession("Promptimizer simulator", session.id), removed: conn };
  }

  refreshSessionLabel(session);
  session.baseline_model = pickBaseline(session.models)?.id ?? null;
  store.set(session.id, session);
  return { session: publicSession(session), removed: conn };
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
  const routedP = enrichModel(routed);
  const baselineP = enrichModel(baseline);
  const rin = routedP.input_per_1m ?? 1;
  const rout = routedP.output_per_1m ?? 3;
  const bin = baselineP.input_per_1m ?? 5;
  const bout = baselineP.output_per_1m ?? 15;
  const cached = Math.min(cachedTokens, promptTokens);
  const fullRouted = (promptTokens / 1e6) * rin + (completionTokens / 1e6) * rout;
  const actual =
    ((promptTokens - cached) / 1e6) * rin + (cached / 1e6) * rin * 0.5 + (completionTokens / 1e6) * rout;
  const baselineUsd = (promptTokens / 1e6) * bin + (completionTokens / 1e6) * bout;
  const saved = Math.max(0, baselineUsd - actual);
  return {
    actual_usd: actual,
    baseline_usd: baselineUsd,
    saved_usd: saved,
    saved_pct: baselineUsd ? (saved / baselineUsd) * 100 : 0,
    routing_saved_usd: Math.max(0, baselineUsd - fullRouted),
    cache_discount_usd: Math.max(0, fullRouted - actual),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cached_tokens: cached,
  };
}

function scoreAnswer(pred: string, gold: string, must: string[], difficulty: number) {
  return scoreAnswerLike(pred, gold || "", difficulty, Number(process.env.QUALITY_ESCALATE_THRESHOLD ?? 0.62), must);
}

function pick(session: Session, classification: Classification, hint?: string) {
  if (hint && hint !== "auto" && hint !== "promptimizer") {
    const found = session.models.find((m) => m.id === hint);
    if (found) return found;
  }
  const start = TIER_ORDER.indexOf(classification.recommended_tier);
  // Prefer recommended tier or anything higher.
  for (const tier of TIER_ORDER.slice(Math.max(0, start))) {
    const model = cheapest(session.models, tier);
    if (model) return model;
  }
  // If the fleet has no model at/above the recommended tier (common when nothing
  // is tagged frontier), step down to the strongest available — never dump hard
  // work onto the cheapest overall model.
  for (let i = Math.max(0, start) - 1; i >= 0; i -= 1) {
    const model = cheapest(session.models, TIER_ORDER[i]);
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

async function complete(
  session: Session,
  model: string,
  messages: Array<{ role: string; content: string }>,
  classification: Classification,
  opts?: { max_tokens?: number; provider_id?: string },
) {
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
  const modelInfo =
    (opts?.provider_id
      ? session.models.find((m) => m.id === model && m.provider_id === opts.provider_id)
      : undefined) ?? session.models.find((m) => m.id === model);
  const conn =
    session.connections.find((c) => c.id === (opts?.provider_id || modelInfo?.provider_id)) ??
    session.connections[0];
  const baseUrl = conn?.base_url || session.base_url;
  const apiKey = conn?.api_key || session.api_key;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(opts?.max_tokens ? { max_tokens: opts.max_tokens } : {}),
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(await response.text()), { status: response.status });
  }
  return response.json();
}

/** Stream tokens from the provider (or mock). Yields text deltas; resolves with full text. */
async function* completeStreaming(
  session: Session,
  model: string,
  messages: Array<{ role: string; content: string }>,
  classification: Classification,
  opts?: { max_tokens?: number; provider_id?: string },
): AsyncGenerator<string, string, void> {
  const prompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (session.mode === "mock") {
    const text = mockAnswer(model, prompt, classification);
    for (const part of text.match(/.{1,12}/g) ?? [text]) {
      yield part;
      await new Promise((r) => setTimeout(r, 8));
    }
    return text;
  }
  const modelInfo =
    (opts?.provider_id
      ? session.models.find((m) => m.id === model && m.provider_id === opts.provider_id)
      : undefined) ?? session.models.find((m) => m.id === model);
  const conn =
    session.connections.find((c) => c.id === (opts?.provider_id || modelInfo?.provider_id)) ??
    session.connections[0];
  const baseUrl = conn?.base_url || session.base_url;
  const apiKey = conn?.api_key || session.api_key;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(opts?.max_tokens ? { max_tokens: opts.max_tokens } : {}),
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(await response.text()), { status: response.status });
  }
  if (!response.body) {
    const json = await response.json();
    const text = String(json.choices?.[0]?.message?.content ?? "");
    yield text;
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content ?? "";
        if (delta) {
          full += delta;
          yield delta;
        }
      } catch {
        /* ignore partial JSON */
      }
    }
  }
  return full;
}

function sseEncode(data: unknown) {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

/**
 * OpenAI-compatible SSE stream. Tokens flush as the provider generates them.
 * Final chunk carries usage + promptimizer meta (same shape as non-stream).
 */
export function routeChatStream(
  session: Session,
  body: Parameters<typeof routeChat>[1],
  opts?: Parameters<typeof routeChat>[2],
  hooks?: { onComplete?: (result: Awaited<ReturnType<typeof routeChat>>) => Promise<void> | void },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const push = (payload: unknown) => controller.enqueue(encoder.encode(sseEncode(payload)));
      try {
        // Resolve routing + caches via the non-stream path only when already cached;
        // for live calls we stream from the provider for low TTFT.
        const textMessages = body.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
        }));
        const userPrompt =
          [...textMessages].reverse().find((m) => m.role === "user")?.content ??
          textMessages.map((m) => m.content).join("\n");
        const classification = classifyText(userPrompt);
        let routed =
          body.model && body.model !== "auto" && body.model !== "promptimizer"
            ? session.models.find((m) => m.id === body.model)
            : pick(session, classification, body.model);
        if (!routed) {
          push({ error: { message: "No selected models.", type: "invalid_request_error" } });
          push("[DONE]");
          controller.close();
          return;
        }

        const exactKey = `pm:exact:${JSON.stringify({ m: textMessages, model: routed.id })}`;
        const promptKey = `pm:prompt:${routed.id}:${userPrompt.trim().toLowerCase().slice(0, 2000)}`;
        let cached =
          (await cacheGet<{ choices?: Array<{ message?: { content?: string } }> }>(exactKey)) ??
          (await cacheGet<{ choices?: Array<{ message?: { content?: string } }> }>(promptKey));
        let text = "";
        let fromCache = false;

        if (cached?.choices?.[0]?.message?.content) {
          fromCache = true;
          text = cached.choices[0].message.content;
          for (const part of text.match(/.{1,24}/g) ?? [text]) {
            push({
              id: `chatcmpl-stream-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: routed.id,
              choices: [{ index: 0, delta: { content: part }, finish_reason: null }],
            });
          }
        } else {
          const stream = completeStreaming(session, routed.id, textMessages, classification, {
            provider_id: routed.provider_id,
          });
          let next = await stream.next();
          while (!next.done) {
            const delta = next.value;
            text += delta;
            push({
              id: `chatcmpl-stream-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: routed.id,
              choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
            });
            next = await stream.next();
          }
          text = next.value || text;
        }

        // Finalize through the normal path so cache / quality / receipts stay consistent.
        // Rebuild a completion-shaped body and let routeChat re-hit prompt/exact cache we just warm.
        if (!fromCache && text) {
          const warm = {
            id: `chatcmpl-stream-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: routed.id,
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
            usage: {
              prompt_tokens: tokens(JSON.stringify(textMessages)),
              completion_tokens: tokens(text),
              total_tokens: tokens(JSON.stringify(textMessages)) + tokens(text),
            },
          };
          await cacheSet(exactKey, warm);
          await cacheSet(promptKey, warm);
        }

        const final = await routeChat(session, { ...body, model: routed.id }, opts);
        if (hooks?.onComplete) await hooks.onComplete(final);
        push({
          id: final.id ?? `chatcmpl-stream-${Date.now()}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: final.model,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: final.usage,
          promptimizer: final.promptimizer,
        });
        push("[DONE]");
      } catch (error) {
        const message = error instanceof Error ? error.message : "stream failed";
        push({ error: { message, type: "server_error" } });
        push("[DONE]");
      } finally {
        controller.close();
      }
    },
  });
}

export async function routeChat(
  session: Session,
  body: {
    messages: Array<{ role: string; content: unknown }>;
    model?: string;
    level_override?: number;
    tools?: unknown[];
    functions?: unknown[];
    response_format?: { type?: string } | null;
    max_tokens?: number;
    max_completion_tokens?: number;
  },
  opts?: { qualityProfiles?: ModelQualityProfile[] },
) {
  const textMessages = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
  }));
  const prompt = textMessages.map((m) => m.content).join("\n");
  const started = Date.now();
  const classification = classifyText(prompt);
  if (body.level_override) {
    classification.complexity = body.level_override;
    classification.recommended_tier = difficultyTier(body.level_override);
    classification.p_small_quality = body.level_override <= 2 ? 0.94 : body.level_override === 3 ? 0.8 : 0.45;
  }

  const requirements = extractRequirements(body);
  const profiles = opts?.qualityProfiles ?? [];
  const profileMap = new Map(profiles.map((p) => [p.model_id, p]));
  const selectedModels = session.models.filter((m) => m.selected).map((m) => toProfile(m));

  let decision: RoutingDecision | null = null;
  let routed: ModelInfo | undefined;
  let routingPolicy: RoutingDecision["policy"] | "bootstrap_heuristic" = "bootstrap_heuristic";

  if (body.model && body.model !== "auto" && body.model !== "promptimizer") {
    routed = session.models.find((m) => m.id === body.model);
    routingPolicy = "bootstrap_heuristic";
  } else {
    decision = chooseModel({
      models: selectedModels,
      requirements,
      qualityProfiles: profileMap,
      expectedInputTokens: Math.max(64, Math.round(prompt.length / 4)),
      expectedOutputTokens: Math.max(128, requirements.minimum_output_tokens || 256),
    });
    if (decision) {
      routingPolicy = decision.policy;
      routed = session.models.find((m) => m.id === decision!.selected_model_id);
    }
  }

  if (!routed) {
    routed = pick(session, classification, body.model);
    routingPolicy = "bootstrap_heuristic";
  }
  if (!routed) throw Object.assign(new Error("No selected models."), { status: 400 });

  const initialModel = routed;
  const baseline = session.models.find((m) => m.id === session.baseline_model) ?? routed;

  const system = textMessages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const prefixKey = system.slice(0, 800);
  const prefixHit = prefixKey.length >= 40 ? await cacheRemember(`pm:prefix:${prefixKey}`) : false;

  const userPrompt =
    [...textMessages].reverse().find((m) => m.role === "user")?.content ?? prompt;

  let semantic: SemanticMatch | null = null;
  let semanticMode: "full" | "hybrid" | "miss" | "off" = "off";
  let exactHit = false;
  let payload: Awaited<ReturnType<typeof complete>> | undefined;

  const exactKey = `pm:exact:${JSON.stringify({ m: textMessages, model: routed.id })}`;
  // Last-user-turn cache: repeating "hi" in a multi-turn REPL still hits even though full history differs.
  const promptKey = `pm:prompt:${routed.id}:${userPrompt.trim().toLowerCase().slice(0, 2000)}`;
  payload = await cacheGet<Awaited<ReturnType<typeof complete>>>(exactKey);
  exactHit = Boolean(payload);
  let promptHit = false;
  if (!payload) {
    payload = await cacheGet<Awaited<ReturnType<typeof complete>>>(promptKey);
    promptHit = Boolean(payload);
  }

  if (!payload) {
    semantic = await findSimilar(userPrompt);
    semanticMode = semantic?.mode ?? "miss";

    if (semantic?.mode === "full") {
      // High similarity → replay cached answer path (no provider call).
      payload = {
        id: `chatcmpl-semantic-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: routed.id,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: semantic.entry.answer },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: tokens(prompt),
          completion_tokens: tokens(semantic.entry.answer),
          total_tokens: tokens(prompt) + tokens(semantic.entry.answer),
        },
      };
    } else if (semantic?.mode === "hybrid") {
      // Similar shared path from cache; novel parts drive model selection + completion.
      const novelComplexity = Math.min(
        5,
        Math.max(
          classification.complexity,
          semantic.novel.length > 280 ? classification.complexity + 1 : classification.complexity,
        ),
      );
      // Prefer a capable model for novel/dissimilar work when the delta looks hard.
      if (novelComplexity >= 4 || semantic.shared_ratio < 0.35) {
        const stronger =
          cheapest(session.models, "frontier") ??
          cheapest(session.models, "standard") ??
          routed;
        if (TIER_ORDER.indexOf(stronger.tier) > TIER_ORDER.indexOf(routed.tier)) {
          routed = stronger;
        }
      } else if (semantic.shared_ratio > 0.7 && novelComplexity <= 2) {
        const cheaper = cheapest(session.models, "economy") ?? routed;
        routed = cheaper;
      }

      const hybridMessages = buildHybridMessages(textMessages, semantic);
      payload = await complete(session, routed.id, hybridMessages, classification, {
        provider_id: routed.provider_id,
      });
      await cacheSet(exactKey, payload);
      await cacheSet(promptKey, payload);
    } else {
      payload = await complete(session, routed.id, textMessages, classification, {
        provider_id: routed.provider_id,
      });
      await cacheSet(exactKey, payload);
      await cacheSet(promptKey, payload);
    }
  } else if (promptHit && !exactHit) {
    // Count as prompt-level cache hit (same last user text).
    semanticMode = "full";
  }

  let escalated = false;
  let escalationReason: string | null = null;
  let text = payload.choices?.[0]?.message?.content ?? "";
  const structuredFail =
    requirements.requires_structured_output &&
    (() => {
      try {
        JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ""));
        return false;
      } catch {
        return true;
      }
    })();

  const requestOrdinal = nextRequestOrdinal(session.id);
  const runAudit = shouldRunAccuracyAudit(requestOrdinal);

  const qualityLive = runQualityGate({
    answer: text,
    prompt: userPrompt,
    complexity: classification.complexity,
    audit: runAudit,
  });

  const cacheSkipEscalate = exactHit || promptHit || semanticMode === "full";
  const shouldEscalate =
    qualityGuardEnabled() &&
    !cacheSkipEscalate &&
    (!text.trim() ||
      text.trim().length < 24 ||
      structuredFail ||
      qualityLive.gate === "fail" ||
      /i don't know|too complex|as a small model|can't help with that|cannot help with that/i.test(text));

  if (shouldEscalate) {
    escalationReason = structuredFail
      ? "structured_output_validation_failed"
      : qualityLive.audit_pass === false
        ? "quality_audit_failed"
        : qualityLive.gate === "fail"
          ? "quality_gate_failed"
          : !text.trim() || text.trim().length < 24
            ? "thin_or_empty_answer"
            : "refusal_or_degraded_heuristic";
    const nextTier = TIER_ORDER[TIER_ORDER.indexOf(routed!.tier) + 1];
    const upgrade = nextTier
      ? cheapest(session.models, nextTier)
      : cheapest(
          session.models.filter((m) => TIER_ORDER.indexOf(m.tier) > TIER_ORDER.indexOf(routed!.tier)),
        );
    if (upgrade && upgrade.id !== routed.id) {
      escalated = true;
      routed = upgrade;
      payload = await complete(session, routed.id, textMessages, classification, {
        provider_id: routed.provider_id,
      });
      text = payload.choices?.[0]?.message?.content ?? "";
      await cacheSet(exactKey, payload);
      await cacheSet(promptKey, payload);
    }
  }

  const promptTokens = payload.usage?.prompt_tokens ?? tokens(prompt);
  const completionTokens = payload.usage?.completion_tokens ?? tokens(text);
  const cost = costOf(routed, baseline, promptTokens, completionTokens, prefixHit ? tokens(prefixKey) : 0);
  const qualityAfter = runQualityGate({
    answer: text,
    prompt: userPrompt,
    complexity: classification.complexity,
    audit: false,
  });
  const qualityFinal = {
    score: qualityAfter.score,
    coverage: qualityAfter.coverage,
    structure: qualityAfter.structure,
    degraded: qualityAfter.degraded,
    notes: qualityAfter.notes,
    gate:
      qualityAfter.gate === "fail" || (qualityLive.audit_pass === false && !escalated)
        ? ("fail" as const)
        : qualityAfter.degraded
          ? ("fail" as const)
          : ("pass" as const),
    audit: qualityLive.audit,
    audit_pass: escalated
      ? qualityAfter.gate === "pass"
        ? true
        : qualityLive.audit_pass
      : qualityLive.audit_pass,
    audit_notes: qualityLive.audit_notes,
  };

  const semanticHit = semanticMode === "full" || semanticMode === "hybrid";
  const anyCacheHit = exactHit || promptHit || prefixHit || semanticMode === "full";

  session.stats.requests += 1;
  session.stats.actual_usd += cost.actual_usd;
  session.stats.baseline_usd += cost.baseline_usd;
  session.stats.saved_usd += cost.saved_usd;
  session.stats.cache_hits += anyCacheHit || semanticMode === "hybrid" ? 1 : 0;
  session.stats.escalations += escalated ? 1 : 0;
  session.stats.quality_fails += qualityFinal.degraded || qualityFinal.gate === "fail" ? 1 : 0;

  // Store vectorized prompt→answer for future similarity lookups (skip empty / failed).
  if (!exactHit && qualityFinal.gate === "pass" && text.trim().length >= 24) {
    await rememberSemantic({
      prompt: userPrompt,
      answer: text,
      model: routed.id,
      tier: routed.tier,
      quality: qualityFinal.score,
    });
  }

  const rationale =
    decision?.rationale ??
    `Bootstrap heuristic: complexity L${classification.complexity}, recommended ${classification.recommended_tier}, chose ${initialModel.id}` +
      (semanticMode === "hybrid"
        ? ` via semantic hybrid (sim=${((semantic?.similarity ?? 0) * 100).toFixed(0)}%).`
        : semanticMode === "full"
          ? ` via semantic full hit (sim=${((semantic?.similarity ?? 0) * 100).toFixed(0)}%).`
          : "") +
      (escalated ? ` then escalated to ${routed.id} (${escalationReason}).` : ".");

  return {
    ...payload,
    model: routed.id,
    usage: { ...payload.usage, prompt_tokens: promptTokens, completion_tokens: completionTokens, cost },
    promptimizer: {
      session_id: session.id,
      request_id: `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      complexity: classification.complexity,
      category: classification.category,
      confidence: classification.confidence,
      p_small_quality: classification.p_small_quality,
      uncertainty: classification.uncertainty,
      tier: routed.tier,
      model: routed.id,
      provider_id: routed.provider_id,
      initial_model: initialModel.id,
      final_model: routed.id,
      baseline_model: baseline.id,
      routing_policy: routingPolicy,
      requirements,
      rejected: decision?.rejected ?? [],
      quality_ineligible: decision?.quality_ineligible ?? [],
      pricing_unknown: decision?.pricing_unknown ?? [],
      estimated_cost_usd: decision?.estimated_cost_usd ?? null,
      estimated_quality: decision?.estimated_quality ?? null,
      cache_hit: anyCacheHit || semanticHit,
      prefix_cache_hit: prefixHit,
      exact_cache_hit: exactHit,
      prompt_cache_hit: promptHit,
      semantic_cache_hit: semanticHit || promptHit,
      semantic_cache_mode: promptHit && !exactHit && semanticMode === "full" ? "prompt" : semanticMode,
      semantic_similarity: semantic?.similarity ?? null,
      semantic_shared_ratio: semantic?.shared_ratio ?? null,
      escalated,
      escalation_reason: escalated ? escalationReason : null,
      escalation_count: escalated ? 1 : 0,
      quality_gate: qualityFinal.gate,
      quality_audit: qualityFinal.audit,
      quality_audit_pass: qualityFinal.audit_pass,
      quality: {
        score: qualityFinal.score,
        coverage: qualityFinal.coverage,
        structure: qualityFinal.structure,
        degraded: qualityFinal.degraded,
        notes: [...qualityFinal.notes, ...qualityFinal.audit_notes],
      },
      latency_ms: Date.now() - started,
      rationale,
    },
  };
}

const POLICY_PREFIX =
  "Account quality policy: prefer a cheap model only when P(quality|small) clears the threshold. Escalate if the cheap answer is thin, refusing, or missing required concepts. This shared prefix is cached across the run.\n\n";

type PolicyKey = "always_frontier" | "difficulty" | "quality" | "quality_cache";

function emptyPolicy() {
  return {
    actual_usd: 0,
    baseline_usd: 0,
    saved_usd: 0,
    routing_saved_usd: 0,
    cache_saved_usd: 0,
    qualities: [] as number[],
    latencies: [] as number[],
    escalations: 0,
    cache_hits: 0,
    quality_fails: 0,
    small: 0,
    frontier_direct: 0,
    successful_escalations: 0,
  };
}

function rollup(p: ReturnType<typeof emptyPolicy>, n: number, frontierAvg: number) {
  const qs = p.qualities;
  const avg = qs.length ? qs.reduce((a, b) => a + b, 0) / qs.length : 0;
  return {
    actual_usd: p.actual_usd,
    baseline_usd: p.baseline_usd,
    saved_usd: p.saved_usd,
    saved_pct: p.baseline_usd ? (p.saved_usd / p.baseline_usd) * 100 : 0,
    routing_saved_usd: p.routing_saved_usd,
    cache_saved_usd: p.cache_saved_usd,
    avg_quality: avg,
    worst_quality: qs.length ? Math.min(...qs) : 0,
    quality_delta: avg - frontierAvg,
    avg_latency_ms: p.latencies.length ? p.latencies.reduce((a, b) => a + b, 0) / p.latencies.length : 0,
    cache_hit_rate: n ? p.cache_hits / n : 0,
    escalation_rate: n ? p.escalations / n : 0,
    quality_fails: p.quality_fails,
    requests: n,
    small_model: p.small,
    frontier_direct: p.frontier_direct,
    escalated: p.escalations,
    successful_escalations: p.successful_escalations,
  };
}

export async function runBenchmark(session: Session) {
  const byTier = {
    economy: cheapest(session.models, "economy"),
    standard: cheapest(session.models, "standard"),
    frontier:
      cheapest(session.models, "frontier") ??
      session.models.find((m) => m.id === session.baseline_model) ??
      cheapest(session.models),
  };
  const policies: Record<PolicyKey, ReturnType<typeof emptyPolicy>> = {
    always_frontier: emptyPolicy(),
    difficulty: emptyPolicy(),
    quality: emptyPolicy(),
    quality_cache: emptyPolicy(),
  };
  const prefixTokens = tokens(POLICY_PREFIX);
  const rows = [];
  const qualitySamples: Array<{ model_id: string; category: string; score: number }> = [];
  const benchmarkId = `bench_${Date.now().toString(36)}`;

  for (const [index, task] of BENCHMARK.entries()) {
    const clf = classifyText(task.prompt);
    const messages = [{ role: "user" as const, content: task.prompt }];
    type Scored = {
      model: ModelInfo;
      text: string;
      tokensIn: number;
      tokensOut: number;
      quality: ReturnType<typeof scoreAnswer>;
      latency: number;
    };
    const scored: Partial<Record<Tier, Scored>> = {};

    // One live call per unique model id; run those in parallel so BYOK benches finish.
    const unique = new Map<string, ModelInfo>();
    for (const tier of TIER_ORDER) {
      const model = byTier[tier];
      if (model) unique.set(model.id, model);
    }
    const byModel = new Map<string, Scored>();
    await Promise.all(
      [...unique.values()].map(async (model) => {
        const t0 = Date.now();
        const payload = await complete(session, model.id, messages, clf, {
          max_tokens: 320,
          provider_id: model.provider_id,
        });
        const text = payload.choices?.[0]?.message?.content ?? "";
        const quality = scoreAnswer(text, task.gold, task.must_include, task.difficulty);
        qualitySamples.push({ model_id: model.id, category: task.category, score: quality.score });
        byModel.set(model.id, {
          model,
          text,
          tokensIn: payload.usage?.prompt_tokens ?? tokens(task.prompt),
          tokensOut: payload.usage?.completion_tokens ?? tokens(text),
          quality,
          latency: Date.now() - t0,
        });
      }),
    );
    for (const tier of TIER_ORDER) {
      const model = byTier[tier];
      if (!model) continue;
      const hit = byModel.get(model.id);
      if (hit) scored[tier] = hit;
    }

    const maybeFrontier = scored.frontier ?? scored.standard ?? scored.economy;
    if (!maybeFrontier) continue;
    const locked: {
      model: ModelInfo;
      text: string;
      tokensIn: number;
      tokensOut: number;
      quality: ReturnType<typeof scoreAnswer>;
      latency: number;
    } = maybeFrontier;

    function pickTier(tier: Tier, escalate: boolean): { chosen: typeof locked; escalated: boolean } {
      const hit = scored[tier];
      let chosen = hit ?? locked;
      let escalated = false;
      if (escalate && chosen.quality.degraded && chosen.model.tier !== "frontier") {
        const next = TIER_ORDER[TIER_ORDER.indexOf(chosen.model.tier) + 1] as Tier | undefined;
        const upgrade = next ? scored[next] : undefined;
        if (upgrade) {
          escalated = true;
          chosen = upgrade;
        }
      }
      return { chosen, escalated };
    }

    function add(key: PolicyKey, chosen: typeof locked, escalated: boolean, cacheHit: boolean) {
      const cachedTok = cacheHit ? prefixTokens : 0;
      const cost = costOf(chosen.model, locked.model, chosen.tokensIn, chosen.tokensOut, cachedTok);
      const bucket = policies[key];
      bucket.actual_usd += cost.actual_usd;
      bucket.baseline_usd += cost.baseline_usd;
      bucket.saved_usd += cost.saved_usd;
      bucket.routing_saved_usd += cost.routing_saved_usd;
      bucket.cache_saved_usd += cost.cache_discount_usd;
      bucket.qualities.push(chosen.quality.score);
      bucket.latencies.push(chosen.latency + (escalated ? 8 : 0));
      bucket.escalations += escalated ? 1 : 0;
      bucket.cache_hits += cacheHit ? 1 : 0;
      bucket.quality_fails += chosen.quality.degraded ? 1 : 0;
      if (escalated) {
        if (!chosen.quality.degraded) bucket.successful_escalations += 1;
      } else if (chosen.model.tier === "frontier") {
        bucket.frontier_direct += 1;
      } else {
        bucket.small += 1;
      }
      return cost;
    }

    add("always_frontier", locked, false, false);

    const naive = pickTier(difficultyTier(clf.complexity), false);
    add("difficulty", naive.chosen, false, false);

    const quality = pickTier(clf.recommended_tier, true);
    add("quality", quality.chosen, quality.escalated, false);

    const cached = pickTier(clf.recommended_tier, true);
    const cost = add("quality_cache", cached.chosen, cached.escalated, index > 0);

    rows.push({
      id: task.id,
      difficulty: task.difficulty,
      category: task.category,
      prompt: task.prompt,
      model: cached.chosen.model.id,
      tier: cached.chosen.model.tier,
      complexity: clf.complexity,
      p_small_quality: clf.p_small_quality,
      escalated: cached.escalated,
      cost,
      quality_routed: cached.chosen.quality,
      quality_frontier: locked.quality,
      quality_delta: cached.chosen.quality.score - locked.quality.score,
      answer: cached.chosen.text,
      frontier_answer: locked.text,
    });
  }

  const n = rows.length;
  const frontierAvg =
    policies.always_frontier.qualities.reduce((a, b) => a + b, 0) / Math.max(1, policies.always_frontier.qualities.length);
  const qualityCache = rollup(policies.quality_cache, n, frontierAvg);
  const quality_profiles = aggregateQualityProfiles(qualitySamples, benchmarkId);
  for (const profile of quality_profiles) {
    const model = session.models.find((m) => m.id === profile.model_id);
    if (model) model.overall_quality = profile.overall_quality;
  }

  return {
    name: "Promptimizer Fixed Task Set",
    tasks: n,
    benchmark_id: benchmarkId,
    evaluator: "deterministic_scoreAnswer",
    policies: {
      always_frontier: rollup(policies.always_frontier, n, frontierAvg),
      difficulty: rollup(policies.difficulty, n, frontierAvg),
      quality: rollup(policies.quality, n, frontierAvg),
      quality_cache: qualityCache,
    },
    summary: {
      actual_usd: qualityCache.actual_usd,
      baseline_usd: qualityCache.baseline_usd,
      saved_usd: qualityCache.saved_usd,
      saved_pct: qualityCache.saved_pct,
      routing_saved_usd: qualityCache.routing_saved_usd,
      cache_saved_usd: qualityCache.cache_saved_usd,
      avg_quality_routed: qualityCache.avg_quality,
      avg_quality_frontier: frontierAvg,
      worst_quality_routed: qualityCache.worst_quality,
      quality_delta: qualityCache.quality_delta,
      avg_latency_ms: qualityCache.avg_latency_ms,
      cache_hit_rate: qualityCache.cache_hit_rate,
      escalation_rate: qualityCache.escalation_rate,
      escalations: qualityCache.escalated,
      cache_hits: policies.quality_cache.cache_hits,
      quality_fails: qualityCache.quality_fails,
      small_model: qualityCache.small_model,
      frontier_direct: qualityCache.frontier_direct,
      successful_escalations: qualityCache.successful_escalations,
    },
    quality_profiles,
    rows,
    session: publicSession(session),
  };
}

export async function sessionForUser(userId: string): Promise<Session> {
  const sid = accountSessionId(userId);
  const cached = store.get(sid);
  if (cached) {
    dedupeFleet(cached);
    try {
      const { loadQualityProfiles } = await import("./account");
      const profiles = await loadQualityProfiles(userId);
      for (const p of profiles) {
        const model = cached.models.find((m) => m.id === p.model_id);
        if (model) model.overall_quality = p.overall_quality;
      }
    } catch {
      /* ignore */
    }
    return cached;
  }
  const { loadAllProviderConnections, loadQualityProfiles } = await import("./account");
  const savedList = await loadAllProviderConnections(userId);
  const byok = savedList.filter((s) => s.mode === "byok" && s.api_key && Array.isArray(s.models) && s.models.length);
  if (byok.length) {
    const connections: ProviderConnection[] = [];
    const models: ModelInfo[] = [];
    const seenBase = new Set<string>();
    for (const saved of byok) {
      const base = normalizeBaseUrl(saved.base_url);
      if (seenBase.has(base)) continue;
      seenBase.add(base);
      const cid = connectionIdFor(base, saved.provider_key ?? undefined);
      connections.push({
        id: cid,
        label: saved.label,
        base_url: base,
        api_key: saved.api_key,
      });
      for (const raw of saved.models as ModelInfo[]) {
        models.push(
          enrichModel({
            ...raw,
            provider_id: cid,
            provider_label: raw.provider_label || saved.label,
            selected: raw.selected !== false,
          }, new Map([[cid, saved.label]])),
        );
      }
    }
    const session: Session = {
      id: sid,
      mode: "byok",
      label: connections.map((c) => c.label).join(" + "),
      base_url: connections[0].base_url,
      api_key: connections[0].api_key,
      connections,
      models,
      baseline_model: null,
      created_at: Date.now() / 1000,
      stats: emptyStats(),
    };
    dedupeFleet(session);
    session.baseline_model = pickBaseline(session.models)?.id ?? null;
    try {
      const profiles = await loadQualityProfiles(userId);
      for (const p of profiles) {
        const model = session.models.find((m) => m.id === p.model_id);
        if (model) model.overall_quality = p.overall_quality;
      }
    } catch {
      /* ignore */
    }
    store.set(sid, session);
    return session;
  }
  createMockSession("Promptimizer simulator", sid);
  return store.get(sid)!;
}

export { publicSession };
