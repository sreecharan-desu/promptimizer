/**
 * Prod smoke test for hackathon demo.
 * Creates a temporary verified user, connects Groq, exercises routing APIs, then cleans up.
 *
 * Usage: node --import tsx scripts/prod-smoke.mts
 * Requires: local .env with DATABASE_URL + JUDGEMENT_BACKEND_MODEL_API_KEY
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const BASE = process.env.SMOKE_BASE_URL || "https://www.promptimizer.site";
const ROOT = resolve(import.meta.dirname, "..");

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  } catch {
    /* missing */
  }
  return out;
}

const env = { ...loadEnvFile(resolve(ROOT, ".env")), ...process.env };
const DATABASE_URL = env.DATABASE_URL || "";
const GROQ_KEY = env.JUDGEMENT_BACKEND_MODEL_API_KEY || env.GROQ_API_KEY || "";

if (!DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!GROQ_KEY?.startsWith("gsk_")) throw new Error("JUDGEMENT_BACKEND_MODEL_API_KEY / GROQ_API_KEY missing or invalid");

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function newId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

type Result = { name: string; ok: boolean; detail: string; ms: number };

const results: Result[] = [];

async function check(name: string, fn: () => Promise<string | void>) {
  const t0 = Date.now();
  try {
    const detail = (await fn()) || "ok";
    results.push({ name, ok: true, detail: String(detail).slice(0, 180), ms: Date.now() - t0 });
  } catch (e) {
    results.push({
      name,
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240),
      ms: Date.now() - t0,
    });
  }
}

function cookieJar() {
  const jar = new Map<string, string>();
  return {
    store(res: Response) {
      const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      const list = raw.length ? raw : [res.headers.get("set-cookie") || ""].filter(Boolean);
      for (const c of list) {
        const part = c.split(";")[0];
        const eq = part.indexOf("=");
        if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function jsonFetch(
  path: string,
  init: RequestInit & { jar?: ReturnType<typeof cookieJar> } = {},
) {
  const headers = new Headers(init.headers || {});
  if (init.jar?.header()) headers.set("cookie", init.jar.header());
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  init.jar?.store(res);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { res, body, text };
}

const email = `demo.smoke.${Date.now()}@promptimizer.test`;
const password = `SmokeTest_${randomBytes(6).toString("hex")}!`;
const userId = newId("usr");
const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });
const jar = cookieJar();
let apiKey = "";
let sessionId = "";

async function main() {
  await check("GET / (landing)", async () => {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return String(res.status);
  });

  await check("GET /api/v1/providers", async () => {
    const { res, body } = await jsonFetch("/api/v1/providers");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const n = Array.isArray((body as { data?: unknown[] }).data) ? (body as { data: unknown[] }).data.length : 0;
    if (n < 5) throw new Error(`expected providers, got ${n}`);
    return `${n} providers`;
  });

  await check("POST /api/v1/classify", async () => {
    const { res, body } = await jsonFetch("/api/v1/classify", {
      method: "POST",
      body: JSON.stringify({ prompt: "What is the capital of France?" }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const tier = (body as { recommended_tier?: string }).recommended_tier;
    if (!tier) throw new Error("missing recommended_tier");
    return `tier=${tier}`;
  });

  await check("DB create verified temp user", async () => {
    await sql`
      INSERT INTO users (id, email, name, password_hash, email_verified_at)
      VALUES (${userId}, ${email}, ${"Smoke Demo"}, ${hashPassword(password)}, now())
    `;
    return userId;
  });

  await check("POST /api/auth/login", async () => {
    const { res, body } = await jsonFetch("/api/auth/login", {
      method: "POST",
      jar,
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    if (!jar.header().includes("pmz_session")) throw new Error("missing pmz_session cookie");
    return "cookie set";
  });

  await check("GET /api/auth/me", async () => {
    const { res, body } = await jsonFetch("/api/auth/me", { jar });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const u = (body as { user?: { email?: string } }).user;
    if (u?.email !== email) throw new Error(`unexpected user ${JSON.stringify(body)}`);
    return email;
  });

  await check("POST /api/account/keys", async () => {
    const { res, body } = await jsonFetch("/api/account/keys", {
      method: "POST",
      jar,
      body: JSON.stringify({ name: "smoke-demo" }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    apiKey = String((body as { key?: string }).key || "");
    if (!apiKey.startsWith("pmz_live_")) throw new Error("missing pmz_live_ key");
    return apiKey.slice(0, 16) + "…";
  });

  await check("POST /api/v1/providers/connect (groq)", async () => {
    const { res, body } = await jsonFetch("/api/v1/providers/connect", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ provider: "groq", api_key: GROQ_KEY }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const b = body as { session_id?: string; models?: unknown[]; baseline_model?: string };
    sessionId = String(b.session_id || "");
    const models = Array.isArray(b.models) ? b.models.length : 0;
    if (models < 1) throw new Error("no models returned");
    // Ensure no UUID junk / non-chat (prompt-guard, orpheus TTS, etc.)
    const bad = (b.models as { id?: string }[]).filter((m) => {
      const id = String(m.id || "");
      return (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
        /(prompt-?guard|safe-?guard|orpheus|embed|whisper|tts)/i.test(id)
      );
    });
    if (bad.length) throw new Error(`non-chat models still present: ${bad.map((m) => m.id).join(",")}`);
    return `models=${models} baseline=${b.baseline_model || "n/a"}`;
  });

  await check("GET /api/v1/session", async () => {
    const { res, body } = await jsonFetch("/api/v1/session", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const conns = (body as { connections?: unknown[] }).connections;
    if (!Array.isArray(conns) || !conns.length) throw new Error("no connections");
    return `connections=${conns.length}`;
  });

  await check("GET /api/v1/models", async () => {
    const { res, body } = await jsonFetch("/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const n = Array.isArray((body as { data?: unknown[] }).data) ? (body as { data: unknown[] }).data.length : 0;
    return `models=${n}`;
  });

  await check("POST /api/v1/chat/completions (auto factual)", async () => {
    const { res, body } = await jsonFetch("/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "auto",
        messages: [{ role: "user", content: "What is the capital of France? Reply with one word." }],
      }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const b = body as {
      choices?: Array<{ message?: { content?: string } }>;
      promptimizer?: { tier?: string; model?: string; quality_gate?: string; escalated?: boolean };
      usage?: { cost?: { saved_pct?: number } };
    };
    const text = String(b.choices?.[0]?.message?.content || "");
    if (!/paris/i.test(text)) throw new Error(`unexpected answer: ${text.slice(0, 120)}`);
    const meta = b.promptimizer || {};
    return `tier=${meta.tier} model=${meta.model} gate=${meta.quality_gate} escalated=${meta.escalated}`;
  });

  await check("POST /api/v1/chat/completions (hard routing)", async () => {
    const { res, body } = await jsonFetch("/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "auto",
        messages: [
          {
            role: "user",
            content:
              "Design a distributed rate limiter for 1M QPS across 50 regions. Discuss Redis, consistency, and failure modes in 4 short bullets.",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const meta = (body as { promptimizer?: { tier?: string; model?: string; complexity?: number; escalated?: boolean } }).promptimizer || {};
    const text = String((body as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || "");
    if (text.length < 40) throw new Error(`thin answer: ${text.slice(0, 80)}`);
    if (/(prompt-?guard|safe-?guard|orpheus)/i.test(String(meta.model || ""))) {
      throw new Error(`routed to non-chat model: ${meta.model}`);
    }
    if (!/(redis|region|consist|fail|limit|qps)/i.test(text)) {
      throw new Error(`answer missing routing substance: ${text.slice(0, 120)}`);
    }
    return `tier=${meta.tier} complexity=${meta.complexity} model=${meta.model} escalated=${meta.escalated} chars=${text.length}`;
  });

  await check("GET /api/v1/savings", async () => {
    const { res, body } = await jsonFetch("/api/v1/savings", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    const b = body as { requests?: number; saved_usd?: number };
    return `requests=${b.requests ?? "n/a"} saved_usd=${b.saved_usd ?? "n/a"}`;
  });

  await check("GET /api/account/savings", async () => {
    const { res, body } = await jsonFetch("/api/account/savings", { jar });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    return "ok";
  });

  await check("POST /api/v1/providers/disconnect (groq)", async () => {
    const { res, body } = await jsonFetch("/api/v1/providers/disconnect", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ provider: "groq" }),
    });
    if (!res.ok) throw new Error(`status ${res.status} ${JSON.stringify(body)}`);
    return "disconnected";
  });

  // cleanup
  await check("cleanup temp user", async () => {
    await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;
    await sql`DELETE FROM providers WHERE user_id = ${userId}`;
    await sql`DELETE FROM usage_events WHERE user_id = ${userId}`;
    await sql`DELETE FROM routing_events WHERE user_id = ${userId}`.catch(() => undefined);
    await sql`DELETE FROM model_quality_profiles WHERE user_id = ${userId}`.catch(() => undefined);
    await sql`DELETE FROM sessions WHERE user_id = ${userId}`.catch(() => undefined);
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return "deleted";
  });

  await sql.end({ timeout: 5 });

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== PROD SMOKE @ " + BASE + " ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.ms}ms)  ${r.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nALL GREEN");
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
  } catch {
    /* ignore */
  }
  try {
    await sql.end({ timeout: 2 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
