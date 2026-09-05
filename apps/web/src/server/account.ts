import { cookies } from "next/headers";
import { authConfigured, ensureSchema, getSql } from "./db";
import { decryptText, encryptText, hashPassword, hashToken, newApiKey, newId, newSessionToken, verifyPassword } from "./crypto";

export const COOKIE = "pmz_session";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
};

export type SavedProvider = {
  id: string;
  user_id: string;
  label: string;
  mode: "byok";
  base_url: string;
  api_key: string;
  baseline_model: string | null;
  models: unknown[];
  provider_key?: string | null;
};

export type PersistableSession = {
  label: string;
  mode: "byok";
  base_url: string;
  api_key: string;
  baseline_model: string | null;
  models: unknown[];
  provider_key?: string;
};

function asRecord(row: unknown) {
  return row as Record<string, unknown>;
}

function publicUser(row: unknown): User {
  const r = asRecord(row);
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
    emailVerified: Boolean(r.email_verified_at),
  };
}

export async function createUser(input: { email: string; password: string; name: string }) {
  await ensureSchema();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || input.password.length < 8) {
    throw Object.assign(new Error("Use a valid email and a password of at least 8 characters."), { status: 400 });
  }
  const sql = getSql();
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length) throw Object.assign(new Error("An account with that email already exists."), { status: 409 });
  const user = { id: newId("usr"), email, name: input.name.trim() || email.split("@")[0], password_hash: hashPassword(input.password) };
  await sql`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.password_hash})
  `;
  return publicUser(user);
}

export async function loginUser(email: string, password: string) {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, email, name, password_hash, avatar_url, email_verified_at
    FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  const row = rows[0];
  const hash = row ? String(asRecord(row).password_hash ?? "") : "";
  if (row && !hash) {
    throw Object.assign(new Error("This account uses Google. Continue with Google."), { status: 401 });
  }
  if (!row || !verifyPassword(password, hash)) {
    throw Object.assign(new Error("Email or password is wrong."), { status: 401 });
  }
  if (!asRecord(row).email_verified_at) {
    throw Object.assign(new Error("Verify your email first. We can send another link."), {
      status: 403,
      code: "unverified",
    });
  }
  return publicUser(row);
}

export async function upsertGoogleUser(input: { email: string; name: string; sub: string; picture?: string }) {
  await ensureSchema();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email.split("@")[0];
  const picture = input.picture?.trim() || null;
  const sql = getSql();
  const existing = await sql`
    SELECT id, email, name, google_sub, avatar_url FROM users
    WHERE google_sub = ${input.sub} OR email = ${email}
    ORDER BY CASE WHEN google_sub = ${input.sub} THEN 0 ELSE 1 END
    LIMIT 1
  `;
  if (existing[0]) {
    const row = asRecord(existing[0]);
    const nextName = String(row.name || "") || name;
    const nextAvatar = picture ?? (row.avatar_url ? String(row.avatar_url) : null);
    await sql`
      UPDATE users
      SET google_sub = ${input.sub},
          name = CASE WHEN name = '' THEN ${name} ELSE name END,
          avatar_url = ${nextAvatar},
          email_verified_at = COALESCE(email_verified_at, now())
      WHERE id = ${String(row.id)}
    `;
    return publicUser({
      ...row,
      name: nextName,
      email: String(row.email),
      avatar_url: nextAvatar,
      email_verified_at: row.email_verified_at ?? new Date(),
    });
  }
  const user = {
    id: newId("usr"),
    email,
    name,
    password_hash: "",
    google_sub: input.sub,
    avatar_url: picture,
    email_verified_at: new Date(),
  };
  await sql`
    INSERT INTO users (id, email, name, password_hash, google_sub, avatar_url, email_verified_at)
    VALUES (${user.id}, ${user.email}, ${user.name}, ${user.password_hash}, ${user.google_sub}, ${user.avatar_url}, ${user.email_verified_at})
  `;
  return publicUser(user);
}

export async function deleteUser(userId: string) {
  await ensureSchema();
  await getSql()`DELETE FROM users WHERE id = ${userId}`;
  try {
    const { destroySession, accountSessionId, invalidateOwnerCaches } = await import("./engine");
    await invalidateOwnerCaches(userId);
    await destroySession(accountSessionId(userId), userId);
  } catch {
    /* best-effort Redis wipe */
  }
}

export async function setPassword(userId: string, password: string) {
  if (password.length < 8) {
    throw Object.assign(new Error("Use a password of at least 8 characters."), { status: 400 });
  }
  await ensureSchema();
  await getSql()`
    UPDATE users
    SET password_hash = ${hashPassword(password)},
        email_verified_at = COALESCE(email_verified_at, now())
    WHERE id = ${userId}
  `;
}

export async function writeSessionCookie(userId: string) {
  const { raw, hash } = newSessionToken();
  await ensureSchema();
  await getSql()`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${hash}, ${userId}, now() + interval '30 days')`;
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && authConfigured()) {
    await ensureSchema();
    await getSql()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  if (!authConfigured()) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  await ensureSchema();
  const rows = await getSql()`
    SELECT u.id, u.email, u.name, u.avatar_url, u.email_verified_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()
  `;
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function listKeys(userId: string) {
  await ensureSchema();
  return getSql()`
    SELECT id, name, prefix, last_used_at, created_at
    FROM api_keys WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
}

export async function createKey(userId: string, name: string) {
  await ensureSchema();
  const { raw, hash, prefix } = newApiKey();
  const id = newId("key");
  await getSql()`
    INSERT INTO api_keys (id, user_id, name, prefix, key_hash)
    VALUES (${id}, ${userId}, ${name.trim() || "Default"}, ${prefix}, ${hash})
  `;
  return { id, name: name.trim() || "Default", prefix, key: raw };
}

export async function revokeKey(userId: string, id: string) {
  await ensureSchema();
  await getSql()`DELETE FROM api_keys WHERE id = ${id} AND user_id = ${userId}`;
}

export async function userFromApiKey(raw: string) {
  if (!raw.startsWith("pmz_")) return null;
  if (!authConfigured()) return null;
  await ensureSchema();
  const rows = await getSql()`
    SELECT u.id, u.email, u.name, k.id AS key_id
    FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${hashToken(raw)}
  `;
  const row = rows[0];
  if (!row) return null;
  await getSql()`UPDATE api_keys SET last_used_at = now() WHERE id = ${String(asRecord(row).key_id)}`;
  return publicUser(row);
}

export async function saveProvider(userId: string, session: PersistableSession) {
  await upsertProviderConnection(userId, session);
}

/** Persist every BYOK host on a multi-provider session. */
export async function persistMultiProviderSession(
  userId: string,
  session: {
    baseline_model: string | null;
    connections: Array<{ id: string; label: string; base_url: string; api_key: string }>;
    models: Array<{ provider_id?: string } & Record<string, unknown>>;
  },
) {
  for (const conn of session.connections) {
    await upsertProviderConnection(userId, {
      label: conn.label,
      mode: "byok",
      base_url: conn.base_url,
      api_key: conn.api_key,
      baseline_model: session.baseline_model,
      models: session.models.filter((m) => m.provider_id === conn.id),
      provider_key: conn.id,
    });
  }
}

/** Upsert one host connection; other hosts stay connected. */
export async function upsertProviderConnection(userId: string, session: PersistableSession) {
  await ensureSchema();
  const sql = getSql();
  const base = session.base_url.replace(/\/$/, "").trim();
  await sql`UPDATE providers SET is_default = false WHERE user_id = ${userId}`;
  // Collapse accidental duplicate rows for the same host (trailing slash / casing drift).
  const twins = await sql`
    SELECT id, base_url FROM providers WHERE user_id = ${userId}
  `;
  const keep = twins.find((row) => String(asRecord(row).base_url).replace(/\/$/, "").toLowerCase() === base.toLowerCase());
  for (const row of twins) {
    const r = asRecord(row);
    const b = String(r.base_url).replace(/\/$/, "").toLowerCase();
    if (b === base.toLowerCase() && keep && String(r.id) !== String(asRecord(keep).id)) {
      await sql`DELETE FROM providers WHERE id = ${String(r.id)}`;
    }
  }
  const existing = await sql`
    SELECT id FROM providers WHERE user_id = ${userId} AND base_url = ${base} LIMIT 1
  `;
  const fleet = JSON.stringify(session.models);
  const keyEnc = encryptText(session.api_key);
  if (existing[0]) {
    const id = String(asRecord(existing[0]).id);
    await sql`
      UPDATE providers SET
        label = ${session.label},
        mode = ${session.mode},
        api_key_encrypted = ${keyEnc},
        baseline_model = ${session.baseline_model},
        fleet_json = ${fleet},
        is_default = true,
        base_url = ${base}
      WHERE id = ${id}
    `;
    return;
  }
  // Also match case-insensitive base if row used different casing.
  if (keep) {
    const id = String(asRecord(keep).id);
    await sql`
      UPDATE providers SET
        label = ${session.label},
        mode = ${session.mode},
        api_key_encrypted = ${keyEnc},
        baseline_model = ${session.baseline_model},
        fleet_json = ${fleet},
        is_default = true,
        base_url = ${base}
      WHERE id = ${id}
    `;
    return;
  }
  const id = newId("prv");
  await sql`
    INSERT INTO providers (id, user_id, label, mode, base_url, api_key_encrypted, baseline_model, fleet_json, is_default)
    VALUES (
      ${id}, ${userId}, ${session.label}, ${session.mode}, ${base},
      ${keyEnc}, ${session.baseline_model}, ${fleet}, true
    )
  `;
}

/** Drop one persisted host by base URL (and optional connection id match on fleet). */
export async function deleteProviderConnection(userId: string, baseUrl: string) {
  await ensureSchema();
  const base = baseUrl.replace(/\/$/, "").toLowerCase();
  await getSql()`
    DELETE FROM providers
    WHERE user_id = ${userId}
      AND lower(regexp_replace(base_url, '/$', '')) = ${base}
  `;
}

export async function loadDefaultProvider(userId: string): Promise<SavedProvider | null> {
  const all = await loadAllProviderConnections(userId);
  return all.find((p) => p.mode === "byok") ?? all[0] ?? null;
}

export async function loadAllProviderConnections(userId: string): Promise<SavedProvider[]> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, user_id, label, mode, base_url, api_key_encrypted, baseline_model, fleet_json
    FROM providers WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return rows.map((row) => {
    const r = asRecord(row);
    const base = String(r.base_url);
    const label = String(r.label);
    return {
      id: String(r.id),
      user_id: String(r.user_id),
      label,
      mode: "byok",
      base_url: base,
      api_key: decryptText(r.api_key_encrypted ? String(r.api_key_encrypted) : ""),
      baseline_model: r.baseline_model ? String(r.baseline_model) : null,
      models: r.fleet_json ? JSON.parse(String(r.fleet_json)) : [],
      provider_key: (() => {
        const models = r.fleet_json ? (JSON.parse(String(r.fleet_json)) as Array<{ provider_id?: string }>) : [];
        const fromModel = models[0]?.provider_id;
        if (fromModel) return fromModel;
        const slug = label.toLowerCase().replace(/\s+/g, "");
        return slug || null;
      })(),
    };
  });
}

export type UsageDetail = {
  request_id?: string;
  rationale?: string;
  initial_model?: string;
  final_model?: string;
  baseline_model?: string;
  complexity?: number | null;
  category?: string;
  routing_policy?: string;
  escalation_reason?: string | null;
  cache_mode?: string;
  exact_cache_hit?: boolean;
  prefix_cache_hit?: boolean;
  prompt_cache_hit?: boolean;
  semantic_cache_hit?: boolean;
  semantic_similarity?: number | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_tokens?: number;
  estimated_cost_usd?: number | null;
  estimated_quality?: number | null;
  quality_score?: number | null;
  quality_notes?: string[];
  rejected?: unknown;
  latency_ms?: number | null;
};

export type UsageEvent = {
  id: string;
  model: string;
  tier: string;
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  routing_saved_usd: number;
  cache_saved_usd: number;
  cache_hit: boolean;
  escalated: boolean;
  quality: number | null;
  semantic_hit: boolean;
  semantic_similarity: number | null;
  quality_gate: string;
  quality_audit: boolean;
  quality_audit_pass: boolean | null;
  prompt: string | null;
  detail: UsageDetail | null;
  created_at: string;
};

const PROMPT_STORE_MAX = 6000;

export function truncatePrompt(text: string, max = PROMPT_STORE_MAX) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function cacheModeFromMeta(meta: Record<string, unknown>): string {
  if (meta.exact_cache_hit) return "exact";
  if (meta.prompt_cache_hit) return "prompt";
  if (meta.prefix_cache_hit) return "prefix";
  if (meta.semantic_cache_hit) {
    const mode = meta.semantic_cache_mode;
    if (mode === "hybrid") return "semantic_hybrid";
    if (mode === "full") return "semantic_full";
    return "semantic";
  }
  if (meta.cache_hit) return "cache";
  return "miss";
}

export function usageDetailFromMeta(
  meta: Record<string, unknown>,
  cost: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
  },
): UsageDetail {
  const quality =
    typeof meta.quality === "object" && meta.quality && !Array.isArray(meta.quality)
      ? (meta.quality as Record<string, unknown>)
      : null;
  return {
    request_id: meta.request_id ? String(meta.request_id) : undefined,
    rationale: meta.rationale ? String(meta.rationale) : undefined,
    initial_model: meta.initial_model ? String(meta.initial_model) : undefined,
    final_model: meta.final_model ? String(meta.final_model) : meta.model ? String(meta.model) : undefined,
    baseline_model: meta.baseline_model ? String(meta.baseline_model) : undefined,
    complexity: meta.complexity == null ? null : Number(meta.complexity),
    category: meta.category ? String(meta.category) : undefined,
    routing_policy: meta.routing_policy ? String(meta.routing_policy) : undefined,
    escalation_reason: meta.escalation_reason ? String(meta.escalation_reason) : null,
    cache_mode: cacheModeFromMeta(meta),
    exact_cache_hit: Boolean(meta.exact_cache_hit),
    prefix_cache_hit: Boolean(meta.prefix_cache_hit),
    prompt_cache_hit: Boolean(meta.prompt_cache_hit),
    semantic_cache_hit: Boolean(meta.semantic_cache_hit),
    semantic_similarity: meta.semantic_similarity == null ? null : Number(meta.semantic_similarity),
    prompt_tokens: cost.prompt_tokens,
    completion_tokens: cost.completion_tokens,
    cached_tokens: cost.cached_tokens,
    estimated_cost_usd: meta.estimated_cost_usd == null ? null : Number(meta.estimated_cost_usd),
    estimated_quality: meta.estimated_quality == null ? null : Number(meta.estimated_quality),
    quality_score: quality && "score" in quality ? Number(quality.score) : null,
    quality_notes: Array.isArray(quality?.notes) ? quality.notes.map(String) : undefined,
    rejected: meta.rejected,
    latency_ms: meta.latency_ms == null ? null : Number(meta.latency_ms),
  };
}

export type SavingsSummary = {
  requests: number;
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  saved_pct: number;
  routing_saved_usd: number;
  cache_saved_usd: number;
  cache_hits: number;
  semantic_hits: number;
  avg_semantic_similarity: number | null;
  escalations: number;
  avg_quality: number | null;
  quality_gate_pass_rate: number | null;
  quality_audits: number;
  quality_audit_passes: number;
  tier_economy: number;
  tier_standard: number;
  tier_frontier: number;
  recent: UsageEvent[];
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function recordUsage(
  userId: string,
  event: {
    model: string;
    tier: string;
    actual_usd: number;
    baseline_usd: number;
    saved_usd: number;
    routing_saved_usd: number;
    cache_saved_usd: number;
    cache_hit: boolean;
    escalated: boolean;
    quality?: number | null;
    semantic_hit?: boolean;
    semantic_similarity?: number | null;
    quality_gate?: string;
    quality_audit?: boolean;
    quality_audit_pass?: boolean | null;
    prompt?: string | null;
    detail?: UsageDetail | null;
  },
) {
  if (!authConfigured()) return;
  await ensureSchema();
  await getSql()`
    INSERT INTO usage_events (
      id, user_id, model, tier, actual_usd, baseline_usd, saved_usd,
      routing_saved_usd, cache_saved_usd, cache_hit, escalated, quality,
      semantic_hit, semantic_similarity, quality_gate, quality_audit, quality_audit_pass,
      prompt, detail_json
    )
    VALUES (
      ${newId("evt")}, ${userId}, ${event.model}, ${event.tier},
      ${event.actual_usd}, ${event.baseline_usd}, ${event.saved_usd},
      ${event.routing_saved_usd}, ${event.cache_saved_usd},
      ${event.cache_hit}, ${event.escalated}, ${event.quality ?? null},
      ${Boolean(event.semantic_hit)}, ${event.semantic_similarity ?? null},
      ${event.quality_gate ?? ""}, ${Boolean(event.quality_audit)},
      ${event.quality_audit_pass ?? null},
      ${event.prompt ? truncatePrompt(event.prompt) : null},
      ${event.detail ? JSON.stringify(event.detail) : null}
    )
  `;
}

function parseDetail(raw: unknown): UsageDetail | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as UsageDetail;
  } catch {
    return null;
  }
}

function eventFromRow(row: unknown): UsageEvent {
  const r = asRecord(row);
  return {
    id: String(r.id),
    model: String(r.model),
    tier: String(r.tier),
    actual_usd: num(r.actual_usd),
    baseline_usd: num(r.baseline_usd),
    saved_usd: num(r.saved_usd),
    routing_saved_usd: num(r.routing_saved_usd),
    cache_saved_usd: num(r.cache_saved_usd),
    cache_hit: Boolean(r.cache_hit),
    escalated: Boolean(r.escalated),
    quality: r.quality == null ? null : num(r.quality),
    semantic_hit: Boolean(r.semantic_hit),
    semantic_similarity: r.semantic_similarity == null ? null : num(r.semantic_similarity),
    quality_gate: r.quality_gate ? String(r.quality_gate) : "",
    quality_audit: Boolean(r.quality_audit),
    quality_audit_pass: r.quality_audit_pass == null ? null : Boolean(r.quality_audit_pass),
    prompt: r.prompt == null || r.prompt === "" ? null : String(r.prompt),
    detail: parseDetail(r.detail_json),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function savingsForUser(userId: string): Promise<SavingsSummary> {
  await ensureSchema();
  const sql = getSql();
  const totals = await sql`
    SELECT
      count(*)::int AS requests,
      coalesce(sum(actual_usd), 0) AS actual_usd,
      coalesce(sum(baseline_usd), 0) AS baseline_usd,
      coalesce(sum(saved_usd), 0) AS saved_usd,
      coalesce(sum(routing_saved_usd), 0) AS routing_saved_usd,
      coalesce(sum(cache_saved_usd), 0) AS cache_saved_usd,
      coalesce(sum(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::int AS cache_hits,
      coalesce(sum(CASE WHEN semantic_hit THEN 1 ELSE 0 END), 0)::int AS semantic_hits,
      avg(semantic_similarity) FILTER (WHERE semantic_similarity IS NOT NULL) AS avg_semantic_similarity,
      coalesce(sum(CASE WHEN escalated THEN 1 ELSE 0 END), 0)::int AS escalations,
      avg(quality) FILTER (WHERE quality IS NOT NULL) AS avg_quality,
      coalesce(sum(CASE WHEN quality_gate = 'pass' THEN 1 ELSE 0 END), 0)::int AS quality_passes,
      coalesce(sum(CASE WHEN quality_gate = 'fail' THEN 1 ELSE 0 END), 0)::int AS quality_fails,
      coalesce(sum(CASE WHEN quality_audit THEN 1 ELSE 0 END), 0)::int AS quality_audits,
      coalesce(sum(CASE WHEN quality_audit_pass IS TRUE THEN 1 ELSE 0 END), 0)::int AS quality_audit_passes,
      coalesce(sum(CASE WHEN tier = 'economy' THEN 1 ELSE 0 END), 0)::int AS tier_economy,
      coalesce(sum(CASE WHEN tier = 'standard' THEN 1 ELSE 0 END), 0)::int AS tier_standard,
      coalesce(sum(CASE WHEN tier = 'frontier' THEN 1 ELSE 0 END), 0)::int AS tier_frontier
    FROM usage_events
    WHERE user_id = ${userId}
  `;
  const recent = await sql`
    SELECT id, model, tier, actual_usd, baseline_usd, saved_usd, routing_saved_usd,
           cache_saved_usd, cache_hit, escalated, quality, semantic_hit, semantic_similarity,
           quality_gate, quality_audit, quality_audit_pass, prompt, detail_json, created_at
    FROM usage_events
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 250
  `;
  const t = asRecord(totals[0] ?? {});
  const baseline = num(t.baseline_usd);
  const saved = num(t.saved_usd);
  const gated = num(t.quality_passes) + num(t.quality_fails);
  return {
    requests: num(t.requests),
    actual_usd: num(t.actual_usd),
    baseline_usd: baseline,
    saved_usd: saved,
    saved_pct: baseline ? (saved / baseline) * 100 : 0,
    routing_saved_usd: num(t.routing_saved_usd),
    cache_saved_usd: num(t.cache_saved_usd),
    cache_hits: num(t.cache_hits),
    semantic_hits: num(t.semantic_hits),
    avg_semantic_similarity: t.avg_semantic_similarity == null ? null : num(t.avg_semantic_similarity),
    escalations: num(t.escalations),
    avg_quality: t.avg_quality == null ? null : num(t.avg_quality),
    quality_gate_pass_rate: gated ? num(t.quality_passes) / gated : null,
    quality_audits: num(t.quality_audits),
    quality_audit_passes: num(t.quality_audit_passes),
    tier_economy: num(t.tier_economy),
    tier_standard: num(t.tier_standard),
    tier_frontier: num(t.tier_frontier),
    recent: recent.map(eventFromRow),
  };
}

export type StoredQualityProfile = {
  model_id: string;
  overall_quality: number;
  reasoning_quality: number;
  coding_quality: number;
  extraction_quality: number;
  factual_quality: number;
  source_benchmark_id: string | null;
  updated_at: string;
};

export async function saveQualityProfiles(
  userId: string,
  profiles: Array<{
    model_id: string;
    overall_quality: number;
    reasoning_quality: number;
    coding_quality: number;
    extraction_quality: number;
    factual_quality: number;
    source_benchmark_id?: string | null;
  }>,
  sourceBenchmarkId?: string,
) {
  if (!authConfigured() || !profiles.length) return;
  await ensureSchema();
  const sql = getSql();
  const bench = sourceBenchmarkId ?? profiles[0]?.source_benchmark_id ?? null;
  for (const p of profiles) {
    await sql`
      INSERT INTO model_quality_profiles (
        id, user_id, model_id, overall_quality, reasoning_quality, coding_quality,
        extraction_quality, factual_quality, source_benchmark_id, updated_at
      )
      VALUES (
        ${newId("mqp")}, ${userId}, ${p.model_id},
        ${p.overall_quality}, ${p.reasoning_quality}, ${p.coding_quality},
        ${p.extraction_quality}, ${p.factual_quality},
        ${p.source_benchmark_id ?? bench}, now()
      )
      ON CONFLICT (user_id, model_id) DO UPDATE SET
        overall_quality = EXCLUDED.overall_quality,
        reasoning_quality = EXCLUDED.reasoning_quality,
        coding_quality = EXCLUDED.coding_quality,
        extraction_quality = EXCLUDED.extraction_quality,
        factual_quality = EXCLUDED.factual_quality,
        source_benchmark_id = EXCLUDED.source_benchmark_id,
        updated_at = now()
    `;
  }
}

export async function loadQualityProfiles(userId: string): Promise<StoredQualityProfile[]> {
  if (!authConfigured()) return [];
  await ensureSchema();
  const rows = await getSql()`
    SELECT model_id, overall_quality, reasoning_quality, coding_quality,
           extraction_quality, factual_quality, source_benchmark_id, updated_at
    FROM model_quality_profiles
    WHERE user_id = ${userId}
  `;
  return rows.map((row) => {
    const r = asRecord(row);
    return {
      model_id: String(r.model_id),
      overall_quality: num(r.overall_quality),
      reasoning_quality: num(r.reasoning_quality),
      coding_quality: num(r.coding_quality),
      extraction_quality: num(r.extraction_quality),
      factual_quality: num(r.factual_quality),
      source_benchmark_id: r.source_benchmark_id == null ? null : String(r.source_benchmark_id),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    };
  });
}

export async function recordRoutingEvent(
  userId: string,
  event: {
    request_id: string;
    policy: string;
    selected_model: string;
    final_model: string;
    estimated_cost_usd?: number | null;
    actual_cost_usd?: number | null;
    estimated_quality?: number | null;
    cache_hit: boolean;
    escalated: boolean;
    escalation_reason?: string | null;
    rejected?: unknown;
    rationale?: string | null;
  },
) {
  if (!authConfigured()) return;
  await ensureSchema();
  await getSql()`
    INSERT INTO routing_events (
      id, user_id, request_id, policy, selected_model, final_model,
      estimated_cost_usd, actual_cost_usd, estimated_quality,
      cache_hit, escalated, escalation_reason, rejected_json, rationale
    )
    VALUES (
      ${newId("rte")}, ${userId}, ${event.request_id}, ${event.policy},
      ${event.selected_model}, ${event.final_model},
      ${event.estimated_cost_usd ?? null}, ${event.actual_cost_usd ?? null},
      ${event.estimated_quality ?? null},
      ${event.cache_hit}, ${event.escalated}, ${event.escalation_reason ?? null},
      ${event.rejected ? JSON.stringify(event.rejected) : null},
      ${event.rationale ?? null}
    )
  `;
}
