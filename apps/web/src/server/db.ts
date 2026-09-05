import postgres from "postgres";

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

const SCHEMA_VERSION = "schema_v6_usage_detail";

export function authConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET && process.env.ENCRYPTION_KEY);
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!sql) {
    const url = process.env.DATABASE_URL;
    sql = postgres(url, {
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return sql;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  mode TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  baseline_model TEXT,
  fleet_json TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS providers_user_idx ON providers(user_id);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT '',
  actual_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  baseline_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  saved_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  routing_saved_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_saved_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  escalated BOOLEAN NOT NULL DEFAULT false,
  quality DOUBLE PRECISION,
  semantic_hit BOOLEAN NOT NULL DEFAULT false,
  semantic_similarity DOUBLE PRECISION,
  quality_gate TEXT NOT NULL DEFAULT '',
  quality_audit BOOLEAN NOT NULL DEFAULT false,
  quality_audit_pass BOOLEAN,
  prompt TEXT,
  detail_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_user_idx ON usage_events(user_id, created_at DESC);
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS semantic_hit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS semantic_similarity DOUBLE PRECISION;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS quality_gate TEXT NOT NULL DEFAULT '';
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS quality_audit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS quality_audit_pass BOOLEAN;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS detail_json TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_tokens_user_purpose_idx ON email_tokens(user_id, purpose);
CREATE TABLE IF NOT EXISTS schema_flags (
  key TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS model_quality_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  overall_quality DOUBLE PRECISION NOT NULL,
  reasoning_quality DOUBLE PRECISION NOT NULL,
  coding_quality DOUBLE PRECISION NOT NULL,
  extraction_quality DOUBLE PRECISION NOT NULL,
  factual_quality DOUBLE PRECISION NOT NULL,
  source_benchmark_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, model_id)
);
CREATE INDEX IF NOT EXISTS model_quality_user_idx ON model_quality_profiles(user_id);
CREATE TABLE IF NOT EXISTS routing_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  policy TEXT NOT NULL DEFAULT 'bootstrap_heuristic',
  selected_model TEXT NOT NULL DEFAULT '',
  final_model TEXT NOT NULL DEFAULT '',
  estimated_cost_usd DOUBLE PRECISION,
  actual_cost_usd DOUBLE PRECISION,
  estimated_quality DOUBLE PRECISION,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalation_reason TEXT,
  rejected_json TEXT,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routing_events_user_idx ON routing_events(user_id, created_at DESC);
`;

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const db = getSql();
      try {
        const rows = await db`SELECT 1 FROM schema_flags WHERE key = ${SCHEMA_VERSION} LIMIT 1`;
        if (rows.length) return;
      } catch {
        /* schema_flags may not exist yet */
      }
      await db.unsafe(SCHEMA);
      const inserted = await db`
        INSERT INTO schema_flags (key) VALUES ('email_verified_backfill_v1')
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `;
      if (inserted.length) {
        await db`UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`;
      }
      await db`
        INSERT INTO schema_flags (key) VALUES (${SCHEMA_VERSION})
        ON CONFLICT (key) DO NOTHING
      `;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}
