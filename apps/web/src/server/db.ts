import postgres from "postgres";

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

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
      max: 4,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_user_idx ON usage_events(user_id, created_at DESC);
`;

export async function ensureSchema() {
  if (!ready) {
    ready = getSql().unsafe(SCHEMA).then(() => undefined);
  }
  await ready;
}
