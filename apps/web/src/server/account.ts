import { cookies } from "next/headers";
import { authConfigured, ensureSchema, getSql } from "./db";
import { decryptText, encryptText, hashPassword, hashToken, newApiKey, newId, newSessionToken, verifyPassword } from "./crypto";

export const COOKIE = "pmz_session";

export type User = { id: string; email: string; name: string };

export type SavedProvider = {
  id: string;
  user_id: string;
  label: string;
  mode: "mock" | "byok";
  base_url: string;
  api_key: string;
  baseline_model: string | null;
  models: unknown[];
};

export type PersistableSession = {
  label: string;
  mode: "mock" | "byok";
  base_url: string;
  api_key: string;
  baseline_model: string | null;
  models: unknown[];
};

function asRecord(row: unknown) {
  return row as Record<string, unknown>;
}

function publicUser(row: unknown): User {
  const r = asRecord(row);
  return { id: String(r.id), email: String(r.email), name: String(r.name) };
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
  const rows = await getSql()`SELECT id, email, name, password_hash FROM users WHERE email = ${email.trim().toLowerCase()}`;
  const row = rows[0];
  if (!row || !verifyPassword(password, String(asRecord(row).password_hash))) {
    throw Object.assign(new Error("Email or password is wrong."), { status: 401 });
  }
  return publicUser(row);
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
    SELECT u.id, u.email, u.name
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
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE providers SET is_default = false WHERE user_id = ${userId}`;
  const id = newId("prv");
  await sql`
    INSERT INTO providers (id, user_id, label, mode, base_url, api_key_encrypted, baseline_model, fleet_json, is_default)
    VALUES (
      ${id}, ${userId}, ${session.label}, ${session.mode}, ${session.base_url},
      ${encryptText(session.api_key)}, ${session.baseline_model},
      ${JSON.stringify(session.models)}, true
    )
  `;
}

export async function loadDefaultProvider(userId: string): Promise<SavedProvider | null> {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, user_id, label, mode, base_url, api_key_encrypted, baseline_model, fleet_json
    FROM providers WHERE user_id = ${userId} AND is_default = true
    ORDER BY created_at DESC LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const r = asRecord(row);
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    label: String(r.label),
    mode: r.mode === "byok" ? "byok" : "mock",
    base_url: String(r.base_url),
    api_key: decryptText(r.api_key_encrypted ? String(r.api_key_encrypted) : ""),
    baseline_model: r.baseline_model ? String(r.baseline_model) : null,
    models: r.fleet_json ? JSON.parse(String(r.fleet_json)) : [],
  };
}

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
  created_at: string;
};

export type SavingsSummary = {
  requests: number;
  actual_usd: number;
  baseline_usd: number;
  saved_usd: number;
  saved_pct: number;
  routing_saved_usd: number;
  cache_saved_usd: number;
  cache_hits: number;
  escalations: number;
  avg_quality: number | null;
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
  },
) {
  if (!authConfigured()) return;
  await ensureSchema();
  await getSql()`
    INSERT INTO usage_events (
      id, user_id, model, tier, actual_usd, baseline_usd, saved_usd,
      routing_saved_usd, cache_saved_usd, cache_hit, escalated, quality
    )
    VALUES (
      ${newId("evt")}, ${userId}, ${event.model}, ${event.tier},
      ${event.actual_usd}, ${event.baseline_usd}, ${event.saved_usd},
      ${event.routing_saved_usd}, ${event.cache_saved_usd},
      ${event.cache_hit}, ${event.escalated}, ${event.quality ?? null}
    )
  `;
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
      coalesce(sum(CASE WHEN escalated THEN 1 ELSE 0 END), 0)::int AS escalations,
      avg(quality) FILTER (WHERE quality IS NOT NULL) AS avg_quality
    FROM usage_events
    WHERE user_id = ${userId}
  `;
  const recent = await sql`
    SELECT id, model, tier, actual_usd, baseline_usd, saved_usd, routing_saved_usd,
           cache_saved_usd, cache_hit, escalated, quality, created_at
    FROM usage_events
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 40
  `;
  const t = asRecord(totals[0] ?? {});
  const baseline = num(t.baseline_usd);
  const saved = num(t.saved_usd);
  return {
    requests: num(t.requests),
    actual_usd: num(t.actual_usd),
    baseline_usd: baseline,
    saved_usd: saved,
    saved_pct: baseline ? (saved / baseline) * 100 : 0,
    routing_saved_usd: num(t.routing_saved_usd),
    cache_saved_usd: num(t.cache_saved_usd),
    cache_hits: num(t.cache_hits),
    escalations: num(t.escalations),
    avg_quality: t.avg_quality == null ? null : num(t.avg_quality),
    recent: recent.map(eventFromRow),
  };
}
