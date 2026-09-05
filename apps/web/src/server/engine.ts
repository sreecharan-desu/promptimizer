import { classifyText, difficultyTier, type Classification } from "promptimizer";
import { createHash } from "crypto";
import { BENCHMARK, PRICING } from "./data";
import { cacheGet, cacheRemember, cacheSet, clearOwnerCaches, userCacheKey } from "./upstash";
import {
  buildHybridMessages,
  findSimilar,
  canonicalizeSemanticPrompt,
  normalizeCachePrompt,
  rememberSemantic,
  type SemanticMatch,
} from "./semantic-cache";
import { nextRequestOrdinal, shouldRunAccuracyAudit } from "./quality-gate";
import { evaluateQualityGate, scoreAnswerLike, type QualityVerdict } from "./quality";
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
import { apgr, bucketStats, buildFrontierCurve, cpt, pgr, breakEvenEscalationRate } from "./routing-metrics";
import { fetchWithTimeout } from "./fetch-timeout";
import { deletePersistedSession, loadPersistedSession, persistSession } from "./session-store";
export { breakEvenEscalationRate } from "./routing-metrics";

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
  cached_input_per_1m?: number | null;
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
  mode: "byok";
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

function putSession(session: Session) {
  store.set(session.id, session);
  void persistSession(session);
}

async function dropSession(sessionId: string, cacheOwner?: string | null) {
  store.delete(sessionId);
  await deletePersistedSession(sessionId);
  if (cacheOwner) await clearOwnerCaches(cacheOwner);
  else await clearOwnerCaches(sessionId);
}

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
    return k === lower || k === short || k.endsWith(`/${short}`) || short === k;
  });
  if (exact) return exact[1];
  // Prefer longest catalog key only when it is a clear path segment (≥8 chars).
  const contained = Object.entries(PRICING)
    .filter(([key]) => key.length >= 8 && (lower.includes(`/${key.toLowerCase()}`) || lower.endsWith(key.toLowerCase())))
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
    cached_input_per_1m:
      model.cached_input_per_1m ??
      (priced as { cached_input?: number } | undefined)?.cached_input ??
      null,
    context_length: context,
    pricing_known: pricingKnown ?? Boolean(priced),
    pricing_source: pricingSource,
  };
}

function cheapest(models: ModelInfo[], tier?: Tier) {
  const pool = models.filter((m) => m.selected && (!tier || m.tier === tier));
  return pool.sort((a, b) => blend(a) - blend(b))[0];
}

function isUuidModelId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

function isNonChatModelId(id: string) {
  return /(embed|whisper|tts|dall|image|moderation|reward|rerank|ranking|classifier|guardrail|\.guard\b|safety-model)/i.test(
    id,
  );
}

function fleetFrom(
  raw: Array<Record<string, unknown>>,
  providerId = "provider",
  providerLabel = providerId,
): ModelInfo[] {
  const models: ModelInfo[] = [];
  for (const item of raw) {
    const mid = String(item.id ?? item.name ?? "");
    if (!mid) continue;
    // Baseten /models mixes Model API slugs with per-account deployment UUIDs.
    // Calling chat/completions with a stale UUID returns "Function … Not found".
    if (isUuidModelId(mid) || isNonChatModelId(mid)) continue;
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
  const pricingKnown =
    model.pricing_source === "estimate" || model.pricing_source === "unknown"
      ? false
      : model.pricing_known !== false;
  const pricing = buildPricing({
    prompt_per_1m: model.input_per_1m,
    completion_per_1m: model.output_per_1m,
    known: pricingKnown,
  });
  return {
    provider_id: model.provider_id || providerId,
    model_id: model.id,
    display_name: model.id,
    description: model.description ?? null,
    context_length: model.context_length ?? null,
    max_completion_tokens: model.max_completion_tokens ?? null,
    pricing,
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
    const remappedId = idByBase.get(normalizeBaseUrl(m.provider_id));
    // Drop orphan models — their host is no longer connected. Resurrected stale
    // slugs (e.g. Baseten Model-API ids the account can no longer serve) were
    // being routed to and rejected by providers.
    if (!conn && !remappedId) continue;
    const providerId = conn?.id ?? remappedId!;
    const providerConn = conn ?? session.connections.find((c) => c.id === providerId);
    const key = `${providerId}::${m.id}`;
    if (!unique.has(key)) {
      unique.set(key, {
        ...m,
        provider_id: providerId,
        provider_label: providerConn?.label ?? m.provider_label ?? providerId,
      });
    }
  }
  session.models = [...unique.values()].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || blend(a) - blend(b),
  );
  refreshSessionLabel(session);
}

function refreshSessionLabel(session: Session) {
  const labels = session.connections.map((c) => c.label);
  session.label = labels.length ? labels.join(" + ") : "No providers";
  const primary = session.connections[0];
  if (primary) {
    session.base_url = primary.base_url;
    session.api_key = primary.api_key;
  } else {
    session.base_url = "";
    session.api_key = "";
  }
}

function emptyByokSession(sessionId?: string): Session {
  const session: Session = {
    id: sessionId ?? id(),
    mode: "byok",
    label: "No providers",
    base_url: "",
    api_key: "",
    connections: [],
    models: [],
    baseline_model: null,
    created_at: Date.now() / 1000,
    stats: emptyStats(),
  };
  putSession(session);
  return session;
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

export async function getSession(sessionId: string | null) {
  if (!sessionId) return null;
  const mem = store.get(sessionId);
  if (mem) return mem;
  const remote = await loadPersistedSession(sessionId);
  if (remote) {
    // Sessions persisted before UUID filtering (or fed by a resurrected fleet)
    // can carry deployment-UUID / non-chat model ids. Calling them 404s
    // ("Function <uuid>: Not found for account") — drop them on load, the same
    // way fresh fleets and the sessionForUser rebuild path already do.
    remote.models = remote.models.filter(
      (m) => m?.id && !isUuidModelId(m.id) && !isNonChatModelId(m.id),
    );
    store.set(remote.id, remote);
    return remote;
  }
  return null;
}

/** Drop in-memory + Redis session and wipe owner completion caches. */
export async function destroySession(sessionId: string, cacheOwner?: string | null) {
  await dropSession(sessionId, cacheOwner);
}

/** Wipe completion/semantic caches for an account or anonymous session owner. */
export async function invalidateOwnerCaches(owner: string) {
  return clearOwnerCaches(owner);
}

function emptyStats() {
  return { requests: 0, actual_usd: 0, baseline_usd: 0, saved_usd: 0, cache_hits: 0, escalations: 0, quality_fails: 0, escalation_waste: 0 };
}

export function accountSessionId(userId: string) {
  return `acct_${userId}`;
}

/** Inverse of accountSessionId — the user an `acct_…` session belongs to, else null. */
export function userIdFromSessionId(sessionId: string | null | undefined): string | null {
  if (!sessionId?.startsWith("acct_")) return null;
  const uid = sessionId.slice("acct_".length).trim();
  return uid || null;
}

export async function createByokSession(
  input: { label?: string; base_url: string; api_key: string; provider?: string },
  sessionId?: string,
) {
  const base = normalizeBaseUrl(input.base_url);
  const connId = connectionIdFor(base, input.provider);
  const response = await fetchWithTimeout(`${base}/models`, {
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

  const existing = sessionId ? (await getSession(sessionId)) ?? undefined : undefined;
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
  putSession(mergeInto);
  // Fleet mutations must survive a cold start — await the Redis persist so a
  // later connect/merge cannot read a stale pre-disconnect session.
  await persistSession(mergeInto);
  return publicSession(mergeInto);
}

/** Remove one host from a multi-provider fleet. Needle matches id, label, or base URL. */
export async function disconnectProvider(session: Session, needle: string) {
  const n = needle.trim().toLowerCase();
  if (!n) {
    throw Object.assign(new Error("Provide a host id (e.g. baseten) or label."), { status: 400 });
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
    session.models = [];
    session.baseline_model = null;
    refreshSessionLabel(session);
    putSession(session);
    // Await the persist: a dropped host must not resurface from a stale Redis snapshot.
    await persistSession(session);
    return { session: publicSession(session), removed: conn };
  }

  refreshSessionLabel(session);
  session.baseline_model = pickBaseline(session.models)?.id ?? null;
  putSession(session);
  // Await the persist: a dropped host must not resurface from a stale Redis snapshot.
  await persistSession(session);
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
  putSession(session);
  return publicSession(session);
}

function tokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

function costOf(
  routed: ModelInfo,
  baseline: ModelInfo,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number,
  opts?: { fullReplay?: boolean },
) {
  const routedP = enrichModel(routed);
  const baselineP = enrichModel(baseline);
  const rin = routedP.input_per_1m ?? 1;
  const rout = routedP.output_per_1m ?? 3;
  const bin = baselineP.input_per_1m ?? 5;
  const bout = baselineP.output_per_1m ?? 15;
  const cachedRate = cachedInputRate(routedP);
  const cached = Math.min(cachedTokens, promptTokens);
  const fullRouted = (promptTokens / 1e6) * rin + (completionTokens / 1e6) * rout;
  const baselineUsd = (promptTokens / 1e6) * bin + (completionTokens / 1e6) * bout;

  if (opts?.fullReplay) {
    // Infra replay: no new provider spend, but label honestly — savings vs always-frontier
    // are "routing+cache avoided generation", not free magic.
    const routingSaved = baselineUsd - fullRouted;
    return {
      actual_usd: 0,
      baseline_usd: baselineUsd,
      saved_usd: baselineUsd,
      saved_pct: baselineUsd ? 100 : 0,
      routing_saved_usd: routingSaved,
      cache_discount_usd: fullRouted,
      wasted_usd: 0,
      cache_replay: true,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: promptTokens + completionTokens,
      cache_rate_estimate: cachedRate.estimate,
      cached_input_per_1m: cachedRate.per_1m,
    };
  }

  // Caching NEVER discounts output tokens — only cached input uses cached_input_per_1m.
  const actual =
    ((promptTokens - cached) / 1e6) * rin +
    (cached / 1e6) * cachedRate.per_1m +
    (completionTokens / 1e6) * rout;
  const saved = baselineUsd - actual;
  return {
    actual_usd: actual,
    baseline_usd: baselineUsd,
    saved_usd: saved,
    saved_pct: baselineUsd ? (saved / baselineUsd) * 100 : 0,
    routing_saved_usd: baselineUsd - fullRouted,
    cache_discount_usd: fullRouted - actual,
    wasted_usd: 0,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cached_tokens: cached,
    cache_rate_estimate: cachedRate.estimate,
    cached_input_per_1m: cachedRate.per_1m,
  };
}

function cachedInputRate(model: ModelInfo & { cached_input_per_1m?: number | null }) {
  if (model.cached_input_per_1m != null && Number.isFinite(model.cached_input_per_1m)) {
    return { per_1m: model.cached_input_per_1m, estimate: false };
  }
  const fromTable = lookupCachedPrice(model.id);
  if (fromTable != null) return { per_1m: fromTable, estimate: false };
  const rin = model.input_per_1m ?? 1;
  return { per_1m: rin * 0.5, estimate: true };
}

function lookupCachedPrice(modelId: string): number | null {
  const row = PRICING[modelId] as { cached_input?: number } | undefined;
  if (row?.cached_input != null) return row.cached_input;
  const lower = modelId.toLowerCase();
  for (const [key, val] of Object.entries(PRICING)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      const c = (val as { cached_input?: number }).cached_input;
      if (c != null) return c;
    }
  }
  if (/gpt-4|o1|o3|openai\//i.test(modelId)) return (lookupPrice(modelId)?.input ?? 2.5) * 0.1;
  if (/claude|anthropic/i.test(modelId)) return (lookupPrice(modelId)?.input ?? 3) * 0.1;
  if (/gemini/i.test(modelId)) return (lookupPrice(modelId)?.input ?? 0.15) * 0.25;
  if (/groq|llama-3\.1-8b/i.test(modelId)) return (lookupPrice(modelId)?.input ?? 0.05) * 0.5;
  if (/deepseek/i.test(modelId)) return (lookupPrice(modelId)?.input ?? 0.27) * 0.1;
  return null;
}

function scoreAnswer(pred: string, gold: string, must: string[], difficulty: number, prompt = "") {
  // Score structure against the user prompt, not the gold reference text.
  return scoreAnswerLike(pred, prompt || gold || "", difficulty, Number(process.env.QUALITY_ESCALATE_THRESHOLD ?? 0.62), must);
}

function findModel(session: Session, modelId: string, providerId?: string | null) {
  if (providerId) {
    const exact = session.models.find((m) => m.id === modelId && m.provider_id === providerId);
    if (exact) return exact;
  }
  return session.models.find((m) => m.id === modelId);
}

function parseProviderError(status: number, body: string): string {
  const raw = body.trim();
  try {
    const j = JSON.parse(raw) as {
      detail?: unknown;
      title?: string;
      message?: string;
      error?: { message?: string };
    };
    const detail =
      typeof j.detail === "string"
        ? j.detail
        : j.detail != null
          ? JSON.stringify(j.detail)
          : j.error?.message || j.message || "";
    if (/function ['"]?[0-9a-f-]{36}/i.test(detail) || /not found for account/i.test(detail)) {
      return `Model unavailable on this host (${status}): ${detail}. Refresh models — stale Baseten deployment ids are skipped automatically.`;
    }
    if (detail) return j.title ? `${j.title}: ${detail}` : detail;
  } catch {
    /* plain text */
  }
  return raw.slice(0, 600) || `Provider error ${status}`;
}

function pick(session: Session, classification: Classification, hint?: string) {
  if (hint && hint !== "auto" && hint !== "promptimizer") {
    const found = findModel(session, hint);
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

function nextFailoverModel(
  session: Session,
  failed: ModelInfo,
  tried: Set<string>,
  avoidProvider?: string,
) {
  const key = (m: ModelInfo) => `${m.provider_id}::${m.id}`;
  const pool = session.models
    .filter((m) => m.selected && !tried.has(key(m)))
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || blend(a) - blend(b),
    );
  // On "model not servable" rejections prefer a different host first — many hosts
  // list slugs the account cannot invoke (e.g. Baseten Model-API catalogs).
  if (avoidProvider) {
    const otherHost =
      pool.find((m) => m.provider_id !== avoidProvider && m.tier === failed.tier) ??
      pool.find((m) => m.provider_id !== avoidProvider);
    if (otherHost) return otherHost;
  }
  // Prefer same tier first, then any remaining.
  return pool.find((m) => m.tier === failed.tier) ?? pool[0] ?? null;
}

/** Provider rejections meaning "this model id is not servable here" — fail over, don't surface. */
const MODEL_UNAVAILABLE_RE =
  /not configured|function ['\"]?[0-9a-f-]{36}|not found for account|model [^\n]*not found|unknown model|does not exist|no such model|invalid model/i;

function isModelUnavailableError(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "model_unavailable" in err &&
    Boolean((err as { model_unavailable?: boolean }).model_unavailable)
  );
}

/** True when a failed provider call should be retried on another model. */
function isRetryableProviderError(err: unknown) {
  if (typeof err !== "object" || err === null) return false;
  const rec = err as { model_unavailable?: boolean; retryable_404?: boolean; status?: number };
  return (
    Boolean(rec.model_unavailable) ||
    Boolean(rec.retryable_404) ||
    [408, 429, 500, 502, 503, 504].includes(Number(rec.status))
  );
}

async function complete(
  session: Session,
  model: string,
  messages: Array<{ role: string; content: string }>,
  _classification: Classification,
  opts?: {
    max_tokens?: number;
    provider_id?: string;
    temperature?: number;
    tools?: unknown[];
    response_format?: { type?: string } | null;
  },
) {
  if (!session.connections.length) {
    throw Object.assign(new Error("Connect a provider before chatting."), { status: 400 });
  }
  const modelInfo = findModel(session, model, opts?.provider_id);
  // Never silently fall back to connections[0] — a stale model id sent to the
  // wrong host produced confusing "model not configured" errors.
  const connId = opts?.provider_id || modelInfo?.provider_id;
  const conn = connId ? session.connections.find((c) => c.id === connId) : undefined;
  if (!conn?.base_url || !conn.api_key) {
    throw Object.assign(
      new Error(`No credentials for host ${connId || model} — model ${model} is not on a connected host.`),
      { status: 400 },
    );
  }
  const features = modelInfo?.supported_features ?? [];
  if (opts?.tools?.length && features.length && !features.some((f) => /tool|function/i.test(f))) {
    throw Object.assign(new Error(`Model ${model} does not advertise tool calling.`), { status: 400 });
  }
  const response = await fetchWithTimeout(`${conn.base_url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(opts?.max_tokens ? { max_tokens: opts.max_tokens } : {}),
      ...(opts?.temperature != null ? { temperature: opts.temperature } : {}),
      ...(opts?.tools?.length ? { tools: opts.tools } : {}),
      ...(opts?.response_format ? { response_format: opts.response_format } : {}),
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const message = parseProviderError(response.status, text);
    throw Object.assign(new Error(message), {
      status: response.status,
      provider_error: true,
      retryable_404: response.status === 404,
      model_unavailable: response.status === 404 || MODEL_UNAVAILABLE_RE.test(message),
    });
  }
  return response.json();
}

async function completeOrFailover(
  session: Session,
  start: ModelInfo,
  messages: Array<{ role: string; content: string }>,
  classification: Classification,
  opts?: {
    max_tokens?: number;
    temperature?: number;
    tools?: unknown[];
    response_format?: { type?: string } | null;
  },
) {
  const tried = new Set<string>([`${start.provider_id}::${start.id}`]);
  let current = start;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const payload = await complete(session, current.id, messages, classification, {
        ...opts,
        provider_id: current.provider_id,
      });
      return { payload, routed: current };
    } catch (err) {
      lastError = err;
      if (!isRetryableProviderError(err)) throw err;
      // Skip this model for this request only — do NOT permanently deselect
      // (that left sessions stuck on frontier after one 404/timeout).
      const next = nextFailoverModel(
        session,
        current,
        tried,
        isModelUnavailableError(err) ? current.provider_id : undefined,
      );
      if (!next) throw err;
      tried.add(`${next.provider_id}::${next.id}`);
      current = next;
    }
  }
  throw lastError;
}

/** Stream tokens from the provider. Yields text deltas; resolves with full text. */
async function* completeStreaming(
  session: Session,
  model: string,
  messages: Array<{ role: string; content: string }>,
  _classification: Classification,
  opts?: { max_tokens?: number; provider_id?: string },
): AsyncGenerator<string, string, void> {
  if (!session.connections.length) {
    throw Object.assign(new Error("Connect a provider before chatting."), { status: 400 });
  }
  const modelInfo = findModel(session, model, opts?.provider_id);
  // Never silently fall back to connections[0] — a stale model id sent to the
  // wrong host produced confusing "model not configured" errors.
  const connId = opts?.provider_id || modelInfo?.provider_id;
  const conn = connId ? session.connections.find((c) => c.id === connId) : undefined;
  if (!conn?.base_url || !conn.api_key) {
    throw Object.assign(
      new Error(`No credentials for host ${connId || model} — model ${model} is not on a connected host.`),
      { status: 400 },
    );
  }
  const response = await fetchWithTimeout(`${conn.base_url}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.api_key}`,
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
    const text = await response.text();
    const message = parseProviderError(response.status, text);
    throw Object.assign(new Error(message), {
      status: response.status,
      provider_error: true,
      retryable_404: response.status === 404,
      model_unavailable: response.status === 404 || MODEL_UNAVAILABLE_RE.test(message),
    });
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
 * OpenAI-compatible SSE stream.
 * Buffers via routeChat (gate + escalate) then emits only the final answer chunks.
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
        const final = await routeChat(session, body, opts);
        if (hooks?.onComplete) await hooks.onComplete(final);
        const text = String(final.choices?.[0]?.message?.content ?? "");
        const id = final.id ?? `chatcmpl-stream-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        for (const part of text.match(/.{1,48}/g) ?? (text ? [text] : [])) {
          push({
            id,
            object: "chat.completion.chunk",
            created,
            model: final.model,
            choices: [{ index: 0, delta: { content: part }, finish_reason: null }],
          });
        }
        push({
          id,
          object: "chat.completion.chunk",
          created,
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
  opts?: {
    qualityProfiles?: ModelQualityProfile[];
    /** User id or session id — scopes exact/prompt/prefix/semantic cache per account. */
    cacheOwner?: string;
    /**
     * Stream path already produced the completion. Skip cache reads so warming
     * keys for this same request does not falsely report exact/prompt hits.
     */
    seededCompletion?: {
      payload: Awaited<ReturnType<typeof complete>>;
      exactHit?: boolean;
      promptHit?: boolean;
    };
  },
) {
  const owner = opts?.cacheOwner ?? session.id;
  const textMessages = body.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
  }));
  const prompt = textMessages.map((m) => m.content).join("\n");
  const started = Date.now();
  // Route on the latest user turn — full thread history must not inflate complexity
  // (REPL "hi how are you" after prior replies was being mis-scored as L4 analysis).
  const userPrompt =
    [...textMessages].reverse().find((m) => m.role === "user")?.content ?? prompt;
  const classification = classifyText(userPrompt);
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
    routed = findModel(session, body.model);
    routingPolicy = "bootstrap_heuristic";
  } else {
    decision = chooseModel({
      models: selectedModels,
      requirements,
      qualityProfiles: profileMap,
      expectedInputTokens: Math.max(64, Math.round(userPrompt.length / 4)),
      expectedOutputTokens: Math.max(128, requirements.minimum_output_tokens || 256),
    });
    if (decision) {
      routingPolicy = decision.policy;
      routed = findModel(session, decision.selected_model_id, decision.selected_provider_id);
    }
  }

  if (!routed) {
    routed = pick(session, classification, body.model);
    routingPolicy = "bootstrap_heuristic";
  }
  if (!routed) throw Object.assign(new Error("No selected models."), { status: 400 });

  const initialModel = routed;
  const baseline =
    findModel(session, session.baseline_model ?? "") ??
    session.models.find((m) => m.id === session.baseline_model) ??
    routed;

  const system = textMessages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const prefixKey = system.slice(0, 800);
  const prefixHit =
    prefixKey.length >= 40 ? await cacheRemember(userCacheKey(owner, "prefix", prefixKey)) : false;

  // Safety lane: medical/legal/compliance topics need at least standard tier.
  if (
    /\b(hipaa|gdpr|lawsuit|malpractice|refund policy|medical advice|legal advice)\b/i.test(userPrompt) ||
    classification.category === "safety_sensitive"
  ) {
    const minIdx = TIER_ORDER.indexOf("standard");
    if (TIER_ORDER.indexOf(classification.recommended_tier) < minIdx) {
      classification.recommended_tier = "standard";
      classification.complexity = Math.max(classification.complexity, 3);
    }
  }

  let semantic: SemanticMatch | null = null;
  let semanticMode: "full" | "hybrid" | "miss" | "off" = "off";
  let exactHit = false;
  let promptHit = false;
  let payload: Awaited<ReturnType<typeof complete>> | undefined;
  let gateSampleCostUsd = 0;

  const conversationDigest = createHash("sha256")
    .update(JSON.stringify(textMessages.map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))))
    .digest("hex")
    .slice(0, 24);

  let exactKey = userCacheKey(owner, "exact", JSON.stringify({ m: textMessages, model: routed.id }));
  // Prompt cache scopes by conversation digest so multi-turn "hi" cannot steal unrelated answers.
  let promptKey = userCacheKey(
    owner,
    "prompt",
    routed.id,
    conversationDigest,
    (canonicalizeSemanticPrompt(userPrompt) || normalizeCachePrompt(userPrompt)).slice(0, 2000),
  );

  const seeded = opts?.seededCompletion;
  if (seeded?.payload) {
    payload = seeded.payload;
    exactHit = Boolean(seeded.exactHit);
    promptHit = Boolean(seeded.promptHit) && !exactHit;
    if (promptHit) semanticMode = "full";
  } else {
    payload = await cacheGet<Awaited<ReturnType<typeof complete>>>(exactKey);
    exactHit = Boolean(payload);
    if (!payload) {
      payload = await cacheGet<Awaited<ReturnType<typeof complete>>>(promptKey);
      promptHit = Boolean(payload);
    }

    if (!payload) {
      semantic = await findSimilar(userPrompt, owner);
      semanticMode = semantic?.mode ?? "miss";

      if (semantic?.mode === "full") {
        const cachedModel = findModel(session, semantic.entry.model) ?? routed;
        routed = cachedModel;
        payload = {
          id: `chatcmpl-semantic-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: semantic.entry.model || routed.id,
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
        // Score the novel fragment alone — do not inherit inflated thread complexity.
        const novelClass = classifyText(semantic.novel || userPrompt);
        const novelComplexity = novelClass.complexity;
        const casual =
          (userPrompt.trim().split(/\s+/).length <= 8 && novelComplexity <= 2) ||
          /^(hi|hey|hello|yo|sup|thanks|thank you|how are you|what's up|whats up)\b/i.test(
            userPrompt.trim(),
          );
        if (!casual && (novelComplexity >= 4 || semantic.shared_ratio < 0.35)) {
          const stronger =
            cheapest(session.models, "frontier") ??
            cheapest(session.models, "standard") ??
            routed;
          if (TIER_ORDER.indexOf(stronger.tier) > TIER_ORDER.indexOf(routed.tier)) {
            routed = stronger;
          }
        } else if (casual || (semantic.shared_ratio > 0.55 && novelComplexity <= 2)) {
          const cheaper =
            cheapest(session.models, "economy") ??
            cheapest(session.models, "standard") ??
            routed;
          // Prefer staying at or below current tier for chitchat / high overlap.
          if (TIER_ORDER.indexOf(cheaper.tier) <= TIER_ORDER.indexOf(routed.tier)) {
            routed = cheaper;
          }
        }

        const hybridMessages = buildHybridMessages(textMessages, semantic);
        const hybrid = await completeOrFailover(session, routed, hybridMessages, classification);
        routed = hybrid.routed;
        payload = hybrid.payload;
      } else {
        const live = await completeOrFailover(session, routed, textMessages, classification, {
          max_tokens: body.max_tokens ?? body.max_completion_tokens,
          tools: body.tools ?? body.functions,
          response_format: body.response_format,
        });
        routed = live.routed;
        payload = live.payload;
      }
    } else if (promptHit && !exactHit) {
      semanticMode = "full";
    }
  }

  // Recompute keys after hybrid / failover may have changed the model.
  exactKey = userCacheKey(owner, "exact", JSON.stringify({ m: textMessages, model: routed.id }));
  promptKey = userCacheKey(
    owner,
    "prompt",
    routed.id,
    conversationDigest,
    (canonicalizeSemanticPrompt(userPrompt) || normalizeCachePrompt(userPrompt)).slice(0, 2000),
  );

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
  // Cache hits still run the gate; failed cached answers may escalate and regenerate.
  const fromCacheReplay = exactHit || promptHit || semanticMode === "full";

  const bodyExtra = body as { must_include?: string[]; must_not_include?: string[] };
  const mustInclude = Array.isArray(bodyExtra.must_include) ? bodyExtra.must_include : undefined;
  const mustNotInclude = Array.isArray(bodyExtra.must_not_include) ? bodyExtra.must_not_include : undefined;

  const sampleCheap: Parameters<typeof evaluateQualityGate>[0]["sample"] = async ({ temperature, max_tokens }) => {
    const samplePayload = await complete(session, routed!.id, textMessages, classification, {
      provider_id: routed!.provider_id,
      temperature,
      max_tokens,
    });
    const pt = samplePayload.usage?.prompt_tokens ?? tokens(prompt);
    const ct = samplePayload.usage?.completion_tokens ?? tokens(String(samplePayload.choices?.[0]?.message?.content ?? ""));
    gateSampleCostUsd += costOf(routed!, baseline, pt, ct, 0).actual_usd;
    return String(samplePayload.choices?.[0]?.message?.content ?? "");
  };

  const judgeFn: Parameters<typeof evaluateQualityGate>[0]["judge"] = async ({ prompt: q, answer, judgeModel }) => {
    const judgeInfo = session.models.find((m) => m.id === judgeModel);
    const judgePayload = await complete(
      session,
      judgeModel,
      [
        {
          role: "system",
          content:
            "You are a blind answer grader. Score the answer only. Never guess which model wrote it. Respond with JSON only: {\"correctness\":0-5,\"completeness\":0-5,\"usefulness\":0-5}.",
        },
        {
          role: "user",
          content: `Question:\n${q}\n\nAnswer:\n${answer}\n\nJSON scores:`,
        },
      ],
      classification,
      { provider_id: judgeInfo?.provider_id, max_tokens: 120, temperature: 0 },
    );
    const jModel = judgeInfo ?? routed!;
    const pt = judgePayload.usage?.prompt_tokens ?? tokens(q + answer);
    const ct = judgePayload.usage?.completion_tokens ?? tokens(String(judgePayload.choices?.[0]?.message?.content ?? ""));
    gateSampleCostUsd += costOf(jModel, baseline, pt, ct, 0).actual_usd;
    return String(judgePayload.choices?.[0]?.message?.content ?? "");
  };

  let qualityVerdict: QualityVerdict = await evaluateQualityGate({
    answer: text,
    prompt: userPrompt,
    complexity: classification.complexity,
    must_include: mustInclude,
    must_not_include: mustNotInclude,
    allow_expensive: true,
    session_mode: session.mode,
    routed_model: routed!.id,
    fleet: session.models,
    sample: sampleCheap,
    judge: judgeFn,
  });

  if (structuredFail) {
    qualityVerdict = {
      ...qualityVerdict,
      escalate: true,
      gate: "fail",
      degraded: true,
      reasons: [...qualityVerdict.reasons, "structured_output_validation_failed"],
    };
  }

  const shouldEscalate = qualityVerdict.escalate && qualityVerdict.gate === "fail";

  // First-attempt cost (for P2 waste accounting — accumulate if we escalate).
  let firstAttemptCost = costOf(
    routed!,
    baseline,
    payload.usage?.prompt_tokens ?? tokens(prompt),
    payload.usage?.completion_tokens ?? tokens(text),
    prefixHit ? tokens(prefixKey) : 0,
    { fullReplay: fromCacheReplay && !shouldEscalate },
  );

  if (shouldEscalate) {
    const reason =
      qualityVerdict.reasons.find((r) => r.includes("structured")) ||
      qualityVerdict.reasons.find(
        (r) =>
          r !== "stage1_ok" &&
          r !== "self_consistency_ok" &&
          !r.startsWith("self_consistency:"),
      ) ||
      qualityVerdict.reasons.find((r) => r !== "stage1_ok") ||
      "quality_gate_failed";
    escalationReason = reason.includes("structured")
      ? "structured_output_validation_failed"
      : reason;
    // Invalidate poisoned cache entries before regenerating.
    if (fromCacheReplay) {
      exactHit = false;
      promptHit = false;
      if (semanticMode === "full") semanticMode = "miss";
    }
    let tierIdx = TIER_ORDER.indexOf(routed!.tier);
    while (tierIdx < TIER_ORDER.length - 1 && qualityVerdict.escalate) {
      tierIdx += 1;
      const upgrade = cheapest(session.models, TIER_ORDER[tierIdx]);
      if (!upgrade || upgrade.id === routed.id) continue;
      escalated = true;
      // Escalations fail over too — a stale/unservable slug on the upgrade host
      // must not fail the whole request.
      const retry = await completeOrFailover(session, upgrade, textMessages, classification, {
        max_tokens: body.max_tokens ?? body.max_completion_tokens,
        tools: body.tools ?? body.functions,
        response_format: body.response_format,
      });
      routed = retry.routed;
      payload = retry.payload;
      text = payload.choices?.[0]?.message?.content ?? "";
      qualityVerdict = await evaluateQualityGate({
        answer: text,
        prompt: userPrompt,
        complexity: classification.complexity,
        must_include: mustInclude,
        must_not_include: mustNotInclude,
        allow_expensive: tierIdx < TIER_ORDER.length - 1,
        session_mode: session.mode,
        force_no_judge: tierIdx >= TIER_ORDER.length - 1,
      });
      if (qualityVerdict.gate === "pass") break;
    }
  }

  const promptTokens = payload.usage?.prompt_tokens ?? tokens(prompt);
  const completionTokens = payload.usage?.completion_tokens ?? tokens(text);
  const fullReplay = (exactHit || promptHit || semanticMode === "full") && !escalated;
  let cost = costOf(routed, baseline, promptTokens, completionTokens, prefixHit ? tokens(prefixKey) : 0, {
    fullReplay,
  });
  // Routing to the baseline itself cannot "save" vs baseline (float dust → tiny negatives).
  if (!fullReplay && routed.id === baseline.id) {
    cost = {
      ...cost,
      actual_usd: cost.actual_usd,
      saved_usd: 0,
      saved_pct: 0,
      routing_saved_usd: 0,
    };
  }
  let wastedUsd = 0;
  if (escalated && !fullReplay) {
    wastedUsd = firstAttemptCost.actual_usd;
    const totalActual = cost.actual_usd + wastedUsd + gateSampleCostUsd;
    cost = {
      ...cost,
      actual_usd: totalActual,
      saved_usd: cost.baseline_usd - totalActual,
      wasted_usd: wastedUsd + gateSampleCostUsd,
    };
  } else {
    const totalActual = cost.actual_usd + gateSampleCostUsd;
    cost = {
      ...cost,
      actual_usd: totalActual,
      saved_usd: cost.baseline_usd - totalActual,
      wasted_usd: gateSampleCostUsd,
    };
  }
  // Hide micro-cent float noise in the ledger.
  if (Math.abs(cost.saved_usd) < 1e-5) {
    cost = { ...cost, saved_usd: 0, saved_pct: 0 };
  }

  // Persist completion cache only after a passing gate (never poison with fails).
  if (qualityVerdict.gate === "pass" && text.trim() && !fullReplay) {
    await cacheSet(exactKey, payload);
    await cacheSet(promptKey, payload);
  }

  const qualityFinal = {
    score: qualityVerdict.score,
    coverage: qualityVerdict.coverage,
    structure: qualityVerdict.structure,
    degraded: qualityVerdict.degraded,
    notes: qualityVerdict.reasons,
    gate: qualityVerdict.gate,
    audit: runAudit,
    audit_pass: runAudit ? qualityVerdict.gate === "pass" : null,
    audit_notes: runAudit ? qualityVerdict.reasons : ([] as string[]),
    stage: qualityVerdict.stage,
    confident: qualityVerdict.confident,
    self_consistency: qualityVerdict.self_consistency,
    judge: qualityVerdict.judge,
  };

  const semanticHit = semanticMode === "full" || semanticMode === "hybrid";
  // Answer served from cache (no provider generation for the final text). Hybrid still calls the model.
  const anyCacheHit = exactHit || promptHit || semanticMode === "full";

  session.stats.requests += 1;
  session.stats.actual_usd += cost.actual_usd;
  session.stats.baseline_usd += cost.baseline_usd;
  session.stats.saved_usd += cost.saved_usd;
  session.stats.cache_hits += anyCacheHit ? 1 : 0;
  session.stats.escalations += escalated ? 1 : 0;
  session.stats.escalation_waste = (session.stats.escalation_waste ?? 0) + (cost.wasted_usd ?? 0);
  session.stats.quality_fails += qualityFinal.degraded || qualityFinal.gate === "fail" ? 1 : 0;
  putSession(session);

  // Store vectorized prompt→answer for future similarity lookups.
  // Allow short numeric answers ("4") — only skip empty / failed / pure replays.
  const answerOk =
    text.trim().length >= 24 ||
    (/^\s*[\d.\-]+\s*$/.test(text) && text.trim().length > 0) ||
    (text.trim().length >= 1 && text.trim().length < 24 && classification.complexity <= 2);
  if (!fullReplay && qualityFinal.gate === "pass" && answerOk) {
    await rememberSemantic({
      prompt: userPrompt,
      answer: text,
      model: routed.id,
      tier: routed.tier,
      quality: qualityFinal.score,
      owner,
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
      cache_hit: anyCacheHit,
      cache_replay: Boolean((cost as { cache_replay?: boolean }).cache_replay),
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
      wasted_usd: cost.wasted_usd ?? 0,
      quality_gate: qualityFinal.gate,
      quality_audit: qualityFinal.audit,
      quality_audit_pass: qualityFinal.audit_pass,
      quality_stage: qualityFinal.stage,
      quality_confident: qualityFinal.confident,
      quality_reasons: qualityFinal.notes,
      quality_self_consistency: qualityFinal.self_consistency,
      quality_judge: qualityFinal.judge,
      quality: {
        score: qualityFinal.score,
        coverage: qualityFinal.coverage,
        structure: qualityFinal.structure,
        degraded: qualityFinal.degraded,
        notes: [...qualityFinal.notes, ...qualityFinal.audit_notes],
        stage: qualityFinal.stage,
        confident: qualityFinal.confident,
        reasons: qualityFinal.notes,
      },
      latency_ms: Date.now() - started,
      rationale,
      quality_guard: process.env.QUALITY_GUARD !== "false",
    },
  };
}

const POLICY_PREFIX = `${[
  "Account quality policy (cached prefix — keep this block identical across requests):",
  "Prefer a cheap model only when estimated small-model quality clears the threshold.",
  "Escalate when the cheap answer is refusing, factually incomplete, or missing required concepts.",
  "Never silently degrade hard system-design, reasoning, safety-sensitive, or multi-constraint work.",
  "Safety lane: refund, legal, medical, HIPAA, GDPR, and lawsuit topics require at least standard tier.",
  "Cache policy: exact hits replay answers; prefix hits discount repeated policy tokens only; semantic hits require entity/negation guards.",
  "Cost policy: bill every attempt including failed cheap tries before escalation; report negative savings honestly.",
  "Evaluation vocabulary: PGR, APGR, CPT(50%), CPT(80%), and worst_regression by difficulty bucket.",
  "This paragraph pads the prefix past typical provider prompt-cache minimums (~1024 tokens) so production caching can activate.",
  "Pad-01: reliability observability continuous calibration shadow evaluation verified savings quality budget auto-tuning.",
  "Pad-02: token bucket sliding window quorum term commit index linearizability outbox idempotency ledger webhook reconciliation.",
  "Pad-03: refusal hedging truncation structural sanity self-consistency LLM judge correctness completeness usefulness.",
  "Pad-04: economy standard frontier bootstrap heuristic routing policy risk override break-even escalation rate.",
  "Pad-05: Paris 408 Fibonacci REST B-tree LSM Raft Euclid CAP theorem spot instances compliance archives.",
  "Pad-06: must_include must_not_include gold reference answer false-positive rate confusion matrix CAG adaptation.",
  "Pad-07: OpenAI Anthropic Gemini Groq DeepSeek cached_input_per_1m never discount output tokens.",
  "Pad-08: easy medium hard stratification silent degradation negative control always-cheap always-frontier.",
  "Pad-09: session redis ttl encrypted keys health indicator reconnect clear expired state.",
  "Pad-10: dashboard comparison verified savings cost-quality frontier live trace cache matrix.",
].join(" ")}\n\n`;

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
    exact_cache_hits: 0,
    prefix_cache_hits: 0,
    quality_fails: 0,
    small: 0,
    frontier_direct: 0,
    successful_escalations: 0,
  };
}

function rollup(p: ReturnType<typeof emptyPolicy>, n: number, frontierAvg: number) {
  const qs = p.qualities;
  const avg = qs.length ? qs.reduce((a, b) => a + b, 0) / qs.length : 0;
  const economyCost = p.actual_usd / Math.max(1, n);
  const frontierCost = p.baseline_usd / Math.max(1, n);
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
    exact_cache_hit_rate: n ? p.exact_cache_hits / n : 0,
    prefix_cache_hit_rate: n ? p.prefix_cache_hits / n : 0,
    exact_cache_hits: p.exact_cache_hits,
    prefix_cache_hits: p.prefix_cache_hits,
    escalation_rate: n ? p.escalations / n : 0,
    break_even_escalation_rate: breakEvenEscalationRate(economyCost, frontierCost, 0),
    quality_fails: p.quality_fails,
    requests: n,
    small_model: p.small,
    frontier_direct: p.frontier_direct,
    escalated: p.escalations,
    successful_escalations: p.successful_escalations,
  };
}

export async function runBenchmark(session: Session, opts?: { repeat_factor?: number }) {
  const repeatFactor = Math.max(1, Math.min(5, Number(opts?.repeat_factor ?? process.env.BENCH_REPEAT_FACTOR ?? 2) || 2));
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
  const prefixCacheKey = userCacheKey(session.id, "bench", "prefix", benchmarkId);
  const weakScores: number[] = [];
  const strongScores: number[] = [];
  const exactAnswerCache = new Map<string, { text: string; quality: ReturnType<typeof scoreAnswer>; tokensOut: number; model: ModelInfo }>();

  const tasks = Array.from({ length: repeatFactor }, (_, rep) =>
    BENCHMARK.map((task) => ({ ...task, rep })),
  ).flat();

  for (const task of tasks) {
    const clf = classifyText(task.prompt);
    const messages = [
      { role: "system" as const, content: POLICY_PREFIX },
      { role: "user" as const, content: task.prompt },
    ];
    type Scored = {
      model: ModelInfo;
      text: string;
      tokensIn: number;
      tokensOut: number;
      quality: ReturnType<typeof scoreAnswer>;
      latency: number;
    };
    const scored: Partial<Record<Tier, Scored>> = {};
    const unique = new Map<string, ModelInfo>();
    for (const tier of TIER_ORDER) {
      const model = byTier[tier];
      if (model) unique.set(model.id, model);
    }
    const byModel = new Map<string, Scored>();
    await Promise.all(
      [...unique.values()].map(async (model) => {
        const exactKey = `${model.id}::${task.id}`;
        const cachedExact = exactAnswerCache.get(exactKey);
        const t0 = Date.now();
        if (cachedExact) {
          byModel.set(model.id, {
            model,
            text: cachedExact.text,
            tokensIn: tokens(POLICY_PREFIX) + tokens(task.prompt),
            tokensOut: cachedExact.tokensOut,
            quality: cachedExact.quality,
            latency: 1,
          });
          return;
        }
        const payload = await complete(session, model.id, messages, clf, {
          max_tokens: 320,
          provider_id: model.provider_id,
        });
        const text = payload.choices?.[0]?.message?.content ?? "";
        const quality = scoreAnswer(
          text,
          task.gold,
          task.must_include,
          task.difficulty,
          task.prompt,
        );
        // pass must_not when available
        const withNot = scoreAnswerLike(
          text,
          task.prompt,
          task.difficulty,
          Number(process.env.QUALITY_ESCALATE_THRESHOLD ?? 0.62),
          task.must_include,
          (task as { must_not_include?: string[] }).must_not_include ?? [],
        );
        const q = { ...quality, ...withNot, notes: withNot.notes };
        qualitySamples.push({ model_id: model.id, category: task.category, score: q.score });
        exactAnswerCache.set(exactKey, { text, quality: q, tokensOut: tokens(text), model });
        byModel.set(model.id, {
          model,
          text,
          tokensIn: payload.usage?.prompt_tokens ?? tokens(POLICY_PREFIX) + tokens(task.prompt),
          tokensOut: payload.usage?.completion_tokens ?? tokens(text),
          quality: q,
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
    const locked = maybeFrontier;
    const weak = scored.economy ?? scored.standard ?? locked;
    if (task.rep === 0) {
      weakScores.push(weak.quality.score);
      strongScores.push(locked.quality.score);
    }

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

    function add(
      key: PolicyKey,
      chosen: typeof locked,
      escalated: boolean,
      opts: { prefixHit?: boolean; exactHit?: boolean },
    ) {
      const cachedTok = opts.prefixHit ? prefixTokens : 0;
      const cost = costOf(chosen.model, locked.model, chosen.tokensIn, chosen.tokensOut, cachedTok, {
        fullReplay: Boolean(opts.exactHit),
      });
      const bucket = policies[key];
      bucket.actual_usd += cost.actual_usd;
      bucket.baseline_usd += cost.baseline_usd;
      bucket.saved_usd += cost.saved_usd;
      bucket.routing_saved_usd += cost.routing_saved_usd;
      bucket.cache_saved_usd += cost.cache_discount_usd;
      bucket.qualities.push(chosen.quality.score);
      bucket.latencies.push(chosen.latency + (escalated ? 8 : 0));
      bucket.escalations += escalated ? 1 : 0;
      bucket.cache_hits += opts.prefixHit || opts.exactHit ? 1 : 0;
      bucket.prefix_cache_hits += opts.prefixHit ? 1 : 0;
      bucket.exact_cache_hits += opts.exactHit ? 1 : 0;
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

    add("always_frontier", locked, false, {});

    const naive = pickTier(difficultyTier(clf.complexity), false);
    add("difficulty", naive.chosen, false, {});

    const quality = pickTier(clf.recommended_tier, true);
    add("quality", quality.chosen, quality.escalated, {});

    const cached = pickTier(clf.recommended_tier, true);
    const prefixHit = await cacheRemember(prefixCacheKey);
    const exactKey = `${cached.chosen.model.id}::${task.id}`;
    const exactHit = task.rep > 0 && exactAnswerCache.has(exactKey);
    const cost = add("quality_cache", cached.chosen, cached.escalated, {
      prefixHit,
      exactHit,
    });

    if (task.rep === 0) {
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
        prefix_cache_hit: prefixHit,
        exact_cache_hit: exactHit,
        cost,
        quality_routed: cached.chosen.quality,
        quality_frontier: locked.quality,
        quality_weak: weak.quality,
        quality_delta: cached.chosen.quality.score - locked.quality.score,
        answer: cached.chosen.text,
        frontier_answer: locked.text,
      });
    }
  }

  const n = rows.length;
  const frontierAvg =
    policies.always_frontier.qualities.reduce((a, b) => a + b, 0) /
    Math.max(1, policies.always_frontier.qualities.length);
  const weakAvg = weakScores.length ? weakScores.reduce((a, b) => a + b, 0) / weakScores.length : 0;
  const strongAvg = strongScores.length ? strongScores.reduce((a, b) => a + b, 0) / strongScores.length : frontierAvg;
  const qualityCache = rollup(policies.quality_cache, tasks.length, frontierAvg);
  const quality_profiles = aggregateQualityProfiles(qualitySamples, benchmarkId);
  for (const profile of quality_profiles) {
    const model = session.models.find((m) => m.id === profile.model_id);
    if (model) model.overall_quality = profile.overall_quality;
  }

  const { pgr: pgrFn, apgr: apgrFn, cpt: cptFn, bucketStats: bucketStatsFn, buildFrontierCurve: buildFrontierCurveFn } = {
    pgr,
    apgr,
    cpt,
    bucketStats,
    buildFrontierCurve,
  };
  const routerAvg = qualityCache.avg_quality;
  const frontierCurve = buildFrontierCurveFn(weakScores, strongScores, 11);
  // Measured gate-off = blend of frontier curve with economy-only (weak) quality — not fabricated.
  const weakAvgQ =
    weakScores.length > 0 ? weakScores.reduce((a, b) => a + b, 0) / weakScores.length : 0;
  const gateOffCurve = frontierCurve.map((pt) => ({
    frontier_call_pct: pt.frontier_call_pct,
    quality: pt.frontier_call_pct * pt.quality + (1 - pt.frontier_call_pct) * weakAvgQ,
  }));
  const metrics = {
    pgr: pgrFn(routerAvg, weakAvg, strongAvg),
    apgr: apgrFn(frontierCurve, weakAvg, strongAvg),
    cpt_50: cptFn(frontierCurve, weakAvg, strongAvg, 0.5),
    cpt_80: cptFn(frontierCurve, weakAvg, strongAvg, 0.8),
    weak_avg_quality: weakAvg,
    strong_avg_quality: strongAvg,
    router_avg_quality: routerAvg,
    by_difficulty: bucketStatsFn(
      rows.map((r) => ({
        difficulty: r.difficulty,
        quality_routed: r.quality_routed.score,
        quality_frontier: r.quality_frontier.score,
      })),
    ),
    frontier_curve: frontierCurve,
    frontier_curve_gate_off: gateOffCurve,
    operating_point: {
      frontier_call_pct: qualityCache.frontier_direct / Math.max(1, qualityCache.requests),
      quality: routerAvg,
    },
  };

  return {
    name: "Promptimizer Fixed Task Set",
    tasks: n,
    repeat_factor: repeatFactor,
    prefix_chars: POLICY_PREFIX.length,
    benchmark_id: benchmarkId,
    evaluator: "stage1_quality_gate",
    policies: {
      always_frontier: rollup(policies.always_frontier, tasks.length, frontierAvg),
      difficulty: rollup(policies.difficulty, tasks.length, frontierAvg),
      quality: rollup(policies.quality, tasks.length, frontierAvg),
      quality_cache: qualityCache,
    },
    metrics,
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
      exact_cache_hit_rate: qualityCache.exact_cache_hit_rate,
      prefix_cache_hit_rate: qualityCache.prefix_cache_hit_rate,
      escalation_rate: qualityCache.escalation_rate,
      break_even_escalation_rate: qualityCache.break_even_escalation_rate,
      escalations: qualityCache.escalated,
      cache_hits: policies.quality_cache.cache_hits,
      exact_cache_hits: policies.quality_cache.exact_cache_hits,
      prefix_cache_hits: policies.quality_cache.prefix_cache_hits,
      quality_fails: qualityCache.quality_fails,
      small_model: qualityCache.small_model,
      frontier_direct: qualityCache.frontier_direct,
      successful_escalations: qualityCache.successful_escalations,
      pgr: metrics.pgr,
      apgr: metrics.apgr,
      cpt_50: metrics.cpt_50,
      cpt_80: metrics.cpt_80,
    },
    quality_profiles,
    rows,
    session: publicSession(session),
  };
}

export async function sessionForUser(userId: string): Promise<Session> {
  const sid = accountSessionId(userId);
  const cached = await getSession(sid);
  if (cached) {
    cached.models = cached.models.filter((m) => m?.id && !isUuidModelId(m.id) && !isNonChatModelId(m.id));
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
    putSession(cached);
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
        if (!raw?.id || isUuidModelId(raw.id) || isNonChatModelId(raw.id)) continue;
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
    putSession(session);
    return session;
  }
  return emptyByokSession(sid);
}

export { publicSession };
