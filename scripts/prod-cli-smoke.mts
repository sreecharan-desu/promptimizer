/**
 * Prod smoke for promptimizer CLI against https://www.promptimizer.site
 * Creates a temp verified user + pmz key, exercises CLI commands in an isolated HOME.
 *
 * Usage: node --import tsx scripts/prod-cli-smoke.mts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

const BASE = process.env.SMOKE_BASE_URL || "https://www.promptimizer.site";
const ROOT = resolve(import.meta.dirname, "..");
const CLI = resolve(ROOT, "packages/cli/bin/promptimizer.mjs");

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
if (!GROQ_KEY?.startsWith("gsk_")) throw new Error("JUDGEMENT_BACKEND_MODEL_API_KEY / GROQ_API_KEY missing");

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

async function check(name: string, fn: () => Promise<string | void> | string | void) {
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

async function jsonFetch(path: string, init: RequestInit & { jar?: ReturnType<typeof cookieJar> } = {}) {
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
    /* keep */
  }
  return { res, body };
}

const home = mkdtempSync(join(tmpdir(), "pmz-cli-smoke-"));
const email = `cli.smoke.${Date.now()}@promptimizer.test`;
const password = `CliSmoke_${randomBytes(6).toString("hex")}!`;
const userId = newId("usr");
const sql = postgres(DATABASE_URL, { ssl: "require", max: 1 });
const jar = cookieJar();
let apiKey = "";

function runCli(args: string[]) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      PROMPTIMIZER_URL: `${BASE}/api`,
      // Avoid env key colliding with saved login during connect tests
      PROMPTIMIZER_API_KEY: "",
    },
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  return { code: r.status ?? 1, out };
}

async function main() {
  await check("DB create verified temp user", async () => {
    await sql`
      INSERT INTO users (id, email, name, password_hash, email_verified_at)
      VALUES (${userId}, ${email}, ${"CLI Smoke"}, ${hashPassword(password)}, now())
    `;
    return userId;
  });

  await check("mint pmz_live_ key via API", async () => {
    const login = await jsonFetch("/api/auth/login", {
      method: "POST",
      jar,
      body: JSON.stringify({ email, password }),
    });
    if (!login.res.ok) throw new Error(`login ${login.res.status}`);
    const keys = await jsonFetch("/api/account/keys", {
      method: "POST",
      jar,
      body: JSON.stringify({ name: "cli-smoke" }),
    });
    if (!keys.res.ok) throw new Error(`keys ${keys.res.status}`);
    apiKey = String((keys.body as { key?: string }).key || "");
    if (!apiKey.startsWith("pmz_live_")) throw new Error("missing pmz key");
    return apiKey.slice(0, 16) + "…";
  });

  await check("cli --version", () => {
    const r = runCli(["--version"]);
    if (r.code !== 0) throw new Error(r.out);
    return r.out.trim();
  });

  await check("cli providers", () => {
    const r = runCli(["providers", "--url", `${BASE}/api`]);
    if (r.code !== 0) throw new Error(r.out);
    if (!/groq/i.test(r.out)) throw new Error("groq missing");
    return "has groq";
  });

  await check("cli login", () => {
    const r = runCli(["login", "--key", apiKey, "--url", `${BASE}/api`]);
    if (r.code !== 0) throw new Error(r.out);
    if (!/Saved/i.test(r.out)) throw new Error(r.out);
    return "saved";
  });

  await check("cli connect groq --key (vendor BYOK)", () => {
    const r = runCli(["connect", "groq", "--key", GROQ_KEY]);
    if (r.code !== 0) throw new Error(r.out);
    if (!/models\s+\d+|Added/i.test(r.out)) throw new Error(r.out);
    if (/prompt-guard|orpheus/i.test(r.out)) throw new Error(`non-chat leaked: ${r.out}`);
    return r.out.replace(/\s+/g, " ").trim().slice(0, 140);
  });

  await check("cli hosts", () => {
    const r = runCli(["hosts"]);
    if (r.code !== 0) throw new Error(r.out);
    if (!/Groq|groq/i.test(r.out)) throw new Error(r.out);
    return r.out.replace(/\s+/g, " ").trim().slice(0, 120);
  });

  await check("cli models", () => {
    const r = runCli(["models"]);
    if (r.code !== 0) throw new Error(r.out);
    if (/prompt-guard|orpheus|safeguard/i.test(r.out)) throw new Error(`non-chat in fleet:\n${r.out}`);
    const lines = r.out.split("\n").filter((l) => l.trim());
    if (lines.length < 2) throw new Error(r.out);
    return `${lines.length} lines`;
  });

  await check("cli chat factual", () => {
    const r = runCli(["chat", "What is the capital of France? Reply with one word."]);
    if (r.code !== 0) throw new Error(r.out);
    if (!/paris/i.test(r.out)) throw new Error(r.out.slice(0, 300));
    return "paris";
  });

  await check("cli chat hard routing", () => {
    const r = runCli([
      "chat",
      "Design a distributed rate limiter for 1M QPS across 50 regions. Discuss Redis, consistency, and failure modes in 4 short bullets.",
    ]);
    if (r.code !== 0) throw new Error(r.out);
    if (r.out.length < 120) throw new Error(`thin: ${r.out.slice(0, 80)}`);
    if (!/(redis|region|limit|qps|consist)/i.test(r.out)) throw new Error(r.out.slice(0, 200));
    return `chars≈${r.out.length}`;
  });

  await check("cli savings", () => {
    const r = runCli(["savings"]);
    if (r.code !== 0) throw new Error(r.out);
    return r.out.replace(/\s+/g, " ").trim().slice(0, 120);
  });

  await check("cli disconnect groq", () => {
    const r = runCli(["disconnect", "groq"]);
    if (r.code !== 0) throw new Error(r.out);
    return "disconnected";
  });

  await check("cli logout", () => {
    const r = runCli(["logout"]);
    if (r.code !== 0) throw new Error(r.out);
    return "ok";
  });

  await check("cleanup temp user", async () => {
    await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;
    await sql`DELETE FROM providers WHERE user_id = ${userId}`;
    await sql`DELETE FROM usage_events WHERE user_id = ${userId}`;
    await sql`DELETE FROM routing_events WHERE user_id = ${userId}`.catch(() => undefined);
    await sql`DELETE FROM model_quality_profiles WHERE user_id = ${userId}`.catch(() => undefined);
    await sql`DELETE FROM users WHERE id = ${userId}`;
    return "deleted";
  });

  await sql.end({ timeout: 5 });
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== CLI PROD SMOKE @ ${BASE} ===\n`);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.ms}ms)  ${r.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nCLI ALL GREEN");
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sql`DELETE FROM api_keys WHERE user_id = ${userId}`;
    await sql`DELETE FROM providers WHERE user_id = ${userId}`;
    await sql`DELETE FROM usage_events WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
    await sql.end({ timeout: 2 });
  } catch {
    /* ignore */
  }
  try {
    rmSync(home, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
