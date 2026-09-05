#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_URL = process.env.PROMPTIMIZER_URL || "https://hackathon-omega-liart.vercel.app/api";
const CONFIG_PATH = join(homedir(), ".promptimizer", "config.json");

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
};

const color = process.stdout.isTTY
  ? (code, text) => `${code}${text}${ANSI.reset}`
  : (_code, text) => text;

const ANSI_OK = Boolean(process.stdout.isTTY);

/** Inline markdown → ANSI (bold, italic, code, links). */
function styleInline(text) {
  let s = String(text);
  // code first so we don't style inside backticks
  s = s.replace(/`([^`]+)`/g, (_, code) => color(ANSI.cyan, code));
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => color(ANSI.bold, t));
  s = s.replace(/__([^_]+)__/g, (_, t) => color(ANSI.bold, t));
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, t) => color(ANSI.dim, t));
  s = s.replace(/(?<!_)_([^_\n]+)_(?!_)/g, (_, t) => color(ANSI.dim, t));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `${color(ANSI.blue, label)} ${color(ANSI.dim, `(${url})`)}`);
  return s;
}

/**
 * Render markdown for the terminal. Keeps structure readable without extra deps.
 * Headers, lists, fences, quotes, hr, tables (plain), paragraphs.
 */
function renderMarkdown(source) {
  if (!source) return "";
  const lines = String(source).replace(/\r\n/g, "\n").split("\n");
  const outLines = [];
  let i = 0;
  let inFence = false;
  let fenceLang = "";

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inFence) {
        inFence = true;
        fenceLang = line.slice(3).trim();
        outLines.push(color(ANSI.dim, fenceLang ? `┌─ ${fenceLang}` : "┌─"));
      } else {
        inFence = false;
        fenceLang = "";
        outLines.push(color(ANSI.dim, "└─"));
      }
      i += 1;
      continue;
    }

    if (inFence) {
      outLines.push(`  ${color(ANSI.cyan, line)}`);
      i += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const title = line.replace(/^#{1,6}\s+/, "");
      const styled = styleInline(title);
      outLines.push(level <= 2 ? color(ANSI.bold, styled) : styled);
      i += 1;
      continue;
    }

    if (/^\s*([-*_] *){3,}\s*$/.test(line)) {
      outLines.push(color(ANSI.dim, "  ───"));
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body = line.replace(/^\s*>\s?/, "");
      outLines.push(`${color(ANSI.dim, "│")} ${styleInline(body)}`);
      i += 1;
      continue;
    }

    const ul = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ul) {
      const indent = Math.min(Math.floor(ul[1].length / 2), 4);
      outLines.push(`${"  ".repeat(indent)}${color(ANSI.magenta, "•")} ${styleInline(ul[3])}`);
      i += 1;
      continue;
    }

    const ol = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (ol) {
      const indent = Math.min(Math.floor(ol[1].length / 2), 4);
      outLines.push(`${"  ".repeat(indent)}${color(ANSI.magenta, `${ol[2]}.`)} ${styleInline(ol[3])}`);
      i += 1;
      continue;
    }

    if (line.includes("|") && line.trim().startsWith("|")) {
      // simple table row — strip pipes, pad lightly
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        i += 1;
        continue; // separator
      }
      outLines.push(`  ${cells.map((c) => styleInline(c)).join(color(ANSI.dim, " · "))}`);
      i += 1;
      continue;
    }

    if (!line.trim()) {
      outLines.push("");
      i += 1;
      continue;
    }

    outLines.push(styleInline(line));
    i += 1;
  }

  // Trim trailing blank lines
  while (outLines.length && outLines[outLines.length - 1] === "") outLines.pop();
  return outLines.join("\n");
}

function printAnswer(text) {
  if (!text) {
    out(color(ANSI.dim, "(empty)"));
    return;
  }
  const rendered = ANSI_OK ? renderMarkdown(text) : text;
  process.stdout.write(`${rendered}\n`);
}

const COMMANDS = [
  ["", "Start interactive session (Gemini-style REPL)"],
  ["login", "Save a Promptimizer API key"],
  ["logout", "Remove the saved key"],
  ["connect", "Add a model host (keeps existing hosts)"],
  ["disconnect", "Remove a model host from the fleet"],
  ["hosts", "List connected hosts"],
  ["chat", "Route one completion"],
  ["models", "List the merged fleet"],
  ["savings", "Show account savings"],
  ["providers", "List known provider URLs"],
];

const COMMAND_HELP = {
  login: [
    "Usage",
    "  promptimizer login --key <pmz_live_...>",
    "",
    "Save a key from /account. Stored in ~/.promptimizer/config.json.",
  ],
  logout: ["Usage", "  promptimizer logout", "", "Deletes ~/.promptimizer/config.json."],
  connect: [
    "Usage",
    "  promptimizer connect <provider> --key <vendor-key>",
    "  promptimizer connect custom --base-url <url> --key <vendor-key>",
    "",
    "Adds a host to your fleet without replacing others.",
    "Aliases: add",
  ],
  disconnect: [
    "Usage",
    "  promptimizer disconnect <provider>",
    "  promptimizer disconnect baseten",
    "  promptimizer disconnect nvidia",
    "",
    "Removes that host and its models. Other hosts stay.",
    "Aliases: remove, rm",
  ],
  hosts: ["Usage", "  promptimizer hosts", "", "Show connected hosts and model counts."],
  chat: [
    "Usage",
    '  promptimizer chat "What is 17 * 24?"',
    "",
    "One-shot. Prefer bare `promptimizer` for a multi-turn session.",
  ],
  models: ["Usage", "  promptimizer models"],
  savings: ["Usage", "  promptimizer savings"],
  providers: ["Usage", "  promptimizer providers"],
};

function die(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function out(message = "") {
  process.stdout.write(`${message}\n`);
}

function parse(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length === 2) {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[arg.slice(1)] = next;
        i += 1;
      } else flags[arg.slice(1)] = true;
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional };
}

/** Parse slash-command args inside the REPL: `/connect baseten --key sk-…` */
function parseLineArgs(line) {
  const parts = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) parts.push(m[1] ?? m[2] ?? m[3]);
  return parse(parts);
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(next) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* best effort */
  }
}

function usd(value) {
  const n = Number(value) || 0;
  return Math.abs(n) >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function printVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
  out(pkg.version);
  return pkg.version;
}

function hostSummary(session) {
  const connections = session?.connections ?? [];
  if (connections.length) {
    return connections
      .map((c) => {
        const count = (session.models ?? []).filter((m) => m.provider_id === c.id).length;
        return `${c.label}${count ? ` (${count})` : ""}`;
      })
      .join(" · ");
  }
  return session?.label || "not connected";
}

function banner(session, version) {
  const hosts = hostSummary(session);
  const models = session?.models?.length ?? 0;
  const baseline = session?.baseline_model || "—";
  const hostCount = session?.connections?.length ?? 0;
  out();
  out(color(ANSI.cyan, "     ██████╗ ███╗   ███╗███████╗"));
  out(color(ANSI.cyan, "     ██╔══██╗████╗ ████║╚══███╔╝"));
  out(color(ANSI.cyan, "     ██████╔╝██╔████╔██║  ███╔╝ "));
  out(color(ANSI.cyan, "     ██╔═══╝ ██║╚██╔╝██║ ███╔╝  "));
  out(color(ANSI.cyan, "     ██║     ██║ ╚═╝ ██║███████╗"));
  out(color(ANSI.cyan, "     ╚═╝     ╚═╝     ╚═╝╚══════╝"));
  out();
  out(`  ${color(ANSI.bold, "Promptimizer")}  ${color(ANSI.dim, `v${version}`)}`);
  out(`  ${color(ANSI.dim, "Quality-aware routing · OpenAI-compatible")}`);
  out();
  out(`  ${color(ANSI.green, "●")} ${hosts}${models ? ` · ${models} models` : ""}`);
  if (hostCount > 1) out(`  ${color(ANSI.dim, `${hostCount} hosts merged · router picks across all`)}`);
  out(`  ${color(ANSI.dim, `baseline ${baseline}`)}`);
  out();
  out(`  ${color(ANSI.dim, "Type a prompt, or /help  /hosts  /models  /connect  /disconnect  /clear  /quit")}`);
  out(`  ${color(ANSI.dim, "Same last message → prompt cache; identical thread → exact cache; /clear resets the thread")}`);
  out();
}

function printFleetSummary(session, { added, removed } = {}) {
  const connections = session.connections ?? [];
  if (added) out(`${color(ANSI.green, "✓")} Added ${added}`);
  if (removed) out(`${color(ANSI.green, "✓")} Removed ${removed}`);
  if (!added && !removed) out(`${color(ANSI.green, "✓")} ${session.label}`);
  if (connections.length) {
    out(`  hosts      ${connections.map((c) => c.label).join(" · ")}`);
  } else {
    out(`  ${session.label}  ${session.base_url}`);
  }
  out(`  models     ${session.models?.length ?? 0} · baseline ${session.baseline_model ?? "—"}`);
}

function help() {
  out("Usage: promptimizer [--url <gateway>] [command] [options]");
  out();
  out("  promptimizer                 Interactive session (REPL)");
  out('  promptimizer chat "…"        One-shot completion');
  out();
  out("Commands");
  const width = Math.max(...COMMANDS.map(([name]) => name.length || 1));
  for (const [name, desc] of COMMANDS) {
    const label = name || "(default)";
    out(`  ${label.padEnd(width + 4)}${desc}`);
  }
  out();
  out("Global options");
  out("  --url, -u     Gateway URL (default: hosted app, or $PROMPTIMIZER_URL)");
  out("  --help, -h    Show help");
  out("  --version, -v Print version");
  out();
  out("Examples");
  out("  promptimizer");
  out("  promptimizer login --key pmz_live_…");
  out("  promptimizer connect baseten --key $BASETEN_API_KEY");
  out("  promptimizer connect nvidia --key $NVIDIA_API_KEY");
  out("  promptimizer hosts");
  out("  promptimizer disconnect nvidia");
  out('  promptimizer chat "What is 17 * 24?"');
  out();
}

function commandHelp(name) {
  const lines = COMMAND_HELP[name];
  if (!lines) die(`Unknown command "${name}". Run promptimizer --help.`);
  out();
  for (const line of lines) out(line);
  out();
}

async function request(path, { method = "GET", body, apiKey, sessionId, gatewayURL } = {}) {
  const headers = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  else if (sessionId) {
    headers.authorization = `Bearer ${sessionId}`;
    headers["x-promptimizer-session"] = sessionId;
  }
  const response = await fetch(`${gatewayURL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data ? String(data.detail) : response.statusText;
    throw Object.assign(new Error(detail), { status: response.status });
  }
  return data;
}

function gateway(flags, config) {
  const url = String(flags.url || flags.u || config.gatewayURL || DEFAULT_URL).replace(/\/$/, "");
  return url.endsWith("/api") ? url : `${url}/api`;
}

function requireKey(flags, config) {
  const apiKey = flags.key || flags.k || process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  if (!apiKey) die("Missing Promptimizer key. Run promptimizer login --key pmz_live_…");
  return String(apiKey);
}

function authFromConfig(flags, config) {
  const apiKey = flags.pmz || process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  const sessionId = apiKey ? undefined : config.sessionId;
  if (!apiKey && !sessionId) {
    throw new Error("Not signed in. Run promptimizer login --key pmz_live_…");
  }
  return { apiKey, sessionId };
}

async function loadSession(flags, config) {
  const gatewayURL = gateway(flags, config);
  const { apiKey, sessionId } = authFromConfig(flags, config);
  return request("/v1/session", { gatewayURL, apiKey, sessionId });
}

function printMeta(result) {
  const meta = result.promptimizer ?? {};
  const saved = result.usage?.cost?.saved_usd;
  const bits = [meta.model || result.model, meta.tier].filter(Boolean);
  if (meta.routing_policy) bits.push(String(meta.routing_policy));
  if (meta.provider_id || meta.host) bits.push(String(meta.provider_id || meta.host));
  if (saved != null) bits.push(`saved ${usd(saved)}`);
  if (meta.exact_cache_hit) bits.push(color(ANSI.green, "exact cache"));
  else if (meta.prompt_cache_hit) bits.push(color(ANSI.green, "prompt cache"));
  else if (meta.semantic_cache_hit) {
    const mode =
      meta.semantic_cache_mode === "full"
        ? "semantic full"
        : meta.semantic_cache_mode === "prompt"
          ? "prompt cache"
          : meta.semantic_cache_mode === "hybrid"
            ? "semantic hybrid"
            : "semantic cache";
    const sim =
      meta.semantic_similarity != null ? ` ${Math.round(Number(meta.semantic_similarity) * 100)}%` : "";
    bits.push(color(ANSI.green, `${mode}${sim}`));
  } else if (meta.prefix_cache_hit) bits.push(color(ANSI.dim, "prefix cache"));
  else bits.push(color(ANSI.gray, "miss"));
  if (meta.quality_gate) bits.push(`gate:${meta.quality_gate}`);
  if (meta.quality_audit) {
    bits.push(meta.quality_audit_pass === false ? color(ANSI.yellow, "audit fail") : "audit ok");
  }
  if (meta.escalated) bits.push(meta.escalation_reason ? `escalated:${meta.escalation_reason}` : "escalated");
  if (meta.latency_ms != null) bits.push(`${Math.round(Number(meta.latency_ms))}ms`);
  out(color(ANSI.dim, `  ↳ ${bits.join(" · ")}`));
}

async function complete(flags, config, messages) {
  const gatewayURL = gateway(flags, config);
  const { apiKey, sessionId } = authFromConfig(flags, config);
  return request("/v1/chat/completions", {
    method: "POST",
    gatewayURL,
    apiKey,
    sessionId,
    body: { messages },
  });
}

/** Stream a completion; buffers tokens then returns { text, result }. */
async function completeStream(flags, config, messages) {
  const gatewayURL = gateway(flags, config);
  const { apiKey, sessionId } = authFromConfig(flags, config);
  const headers = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  else if (sessionId) {
    headers.authorization = `Bearer ${sessionId}`;
    headers["x-promptimizer-session"] = sessionId;
  }
  const response = await fetch(`${gatewayURL}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, stream: true }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail =
      typeof data === "object" && data && "detail" in data ? String(data.detail) : response.statusText;
    throw Object.assign(new Error(detail), { status: response.status });
  }
  if (!response.body) {
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content?.trim() ?? "", result: data };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let result = {
    model: undefined,
    usage: undefined,
    promptimizer: undefined,
    choices: [{ message: { role: "assistant", content: "" } }],
  };
  let spinTimer = null;
  let spinFrame = 0;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  if (ANSI_OK) {
    spinTimer = setInterval(() => {
      const frame = frames[spinFrame++ % frames.length];
      process.stdout.write(`\r${color(ANSI.dim, `  ${frame} routing…`)}`);
    }, 80);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error?.message) throw new Error(parsed.error.message);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) text += delta;
          if (parsed.promptimizer) result.promptimizer = parsed.promptimizer;
          if (parsed.usage) result.usage = parsed.usage;
          if (parsed.model) result.model = parsed.model;
        } catch (err) {
          if (err instanceof Error && err.message && !err.message.includes("JSON")) throw err;
        }
      }
    }
  } finally {
    if (spinTimer) {
      clearInterval(spinTimer);
      process.stdout.write("\r\x1b[2K");
    }
  }

  result.choices = [{ message: { role: "assistant", content: text } }];
  return { text, result };
}

async function cmdLogin(flags) {
  const apiKey = flags.key || flags.k || process.env.PROMPTIMIZER_API_KEY;
  if (!apiKey) die("Missing --key. Create one at /account.");
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  await request("/v1/session", { apiKey, gatewayURL });
  writeConfig({ ...config, gatewayURL, apiKey });
  out(`${color(ANSI.green, "✓")} Saved  ${gatewayURL}`);
}

function cmdLogout() {
  try {
    rmSync(CONFIG_PATH, { force: true });
  } catch (error) {
    die(error instanceof Error ? error.message : String(error));
  }
  out(`${color(ANSI.green, "✓")} Logged out`);
  out(color(ANSI.dim, `  Removed ${CONFIG_PATH}`));
  out(color(ANSI.dim, "  Run: promptimizer login --key pmz_live_…"));
}

async function cmdProviders(flags) {
  const config = readConfig();
  const data = await request("/v1/providers", { gatewayURL: gateway(flags, config) });
  const rows = data.data ?? [];
  const width = Math.max(8, ...rows.map((row) => String(row.id).length));
  out();
  for (const row of rows) out(`  ${String(row.id).padEnd(width + 2)}${row.base_url}`);
  out();
  out("  custom              pass --base-url");
  out();
}

async function cmdConnect(flags, positional) {
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  const provider = String(flags.provider || positional[0] || "").trim();
  const baseURL = flags["base-url"] || flags.baseUrl;
  if (!provider && !baseURL) {
    die(
      "Usage: promptimizer connect <provider> --key <vendor-key>\n       promptimizer connect custom --base-url https://… --key …",
    );
  }

  const mock = provider === "simulator" || provider === "mock";
  if (mock) {
    die("Simulator mode was removed. Connect a real provider, e.g. promptimizer connect baseten --key …");
  }
  let vendorKey = flags.key || flags.k;
  let label = flags.label;
  if (!baseURL && provider && provider !== "custom") {
    const catalog = await request("/v1/providers", { gatewayURL });
    const found = (catalog.data ?? []).find(
      (row) => row.id === provider || String(row.label).toLowerCase() === provider.toLowerCase(),
    );
    if (!found) die(`Unknown provider "${provider}". Run promptimizer providers, or pass --base-url.`);
    if (!vendorKey && found.env && process.env[found.env]) vendorKey = process.env[found.env];
    if (!vendorKey) {
      die(`Missing API key for ${found.label}. Pass --key or set ${found.env}.`);
    }
    label = label || found.label;
  } else if (!vendorKey) {
    die("Missing provider key. Pass --key.");
  }

  const apiKey = flags.pmz || process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  const session = await request("/v1/providers/connect", {
    method: "POST",
    gatewayURL,
    apiKey,
    body: {
          mode: "byok",
          label,
          provider: provider && provider !== "custom" ? provider : undefined,
          base_url: baseURL,
          api_key: vendorKey,
        },
  });

  writeConfig({ ...config, gatewayURL, apiKey, sessionId: session.session_id });
  out();
  printFleetSummary(session, { added: label || provider || session.label });
  out();
  return session;
}

async function cmdDisconnect(flags, positional) {
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  const provider = String(flags.provider || flags.host || positional[0] || "").trim();
  if (!provider) die("Usage: promptimizer disconnect <provider>\n       promptimizer disconnect baseten");

  const { apiKey, sessionId } = authFromConfig(flags, config);
  const session = await request("/v1/providers/disconnect", {
    method: "POST",
    gatewayURL,
    apiKey,
    sessionId,
    body: { provider },
  });

  writeConfig({ ...config, gatewayURL, apiKey, sessionId: session.session_id ?? sessionId });
  out();
  printFleetSummary(session, { removed: session.removed?.label || provider });
  out();
  return session;
}

async function cmdHosts(flags) {
  const config = readConfig();
  const session = await loadSession(flags, config);
  const connections = session.connections ?? [];
  out();
  if (!connections.length) {
    out(`  ${color(ANSI.dim, "No hosts connected.")}`);
    out(`  ${color(ANSI.dim, "Add: promptimizer connect <host> --key …")}`);
    out();
    return session;
  }
  const width = Math.max(8, ...connections.map((c) => String(c.label).length));
  for (const c of connections) {
    const count = (session.models ?? []).filter((m) => m.provider_id === c.id).length;
    out(`  ${color(ANSI.green, "✓")} ${c.label.padEnd(width + 2)}${count} models`);
    out(`    ${color(ANSI.dim, c.base_url)}`);
  }
  out();
  out(`  ${session.models?.length ?? 0} models total · baseline ${session.baseline_model ?? "—"}`);
  out(`  ${color(ANSI.dim, "Add: promptimizer connect <host> --key …")}`);
  out(`  ${color(ANSI.dim, "Remove: promptimizer disconnect <host>")}`);
  out();
  return session;
}

async function cmdChat(flags, positional) {
  const config = readConfig();
  const prompt = String(flags.prompt || positional.join(" ")).trim();
  if (!prompt) die('Usage: promptimizer chat "What is 17 * 24?"');
  out();
  out(color(ANSI.magenta, "✦"));
  const { text, result } = await completeStream(flags, config, [{ role: "user", content: prompt }]);
  printAnswer(text);
  out();
  printMeta(result);
  out();
}

async function cmdModels(flags) {
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  const { apiKey, sessionId } = authFromConfig(flags, config);
  const [data, session] = await Promise.all([
    request("/v1/models", { gatewayURL, apiKey, sessionId }),
    request("/v1/session", { gatewayURL, apiKey, sessionId }).catch(() => null),
  ]);
  const models = data.data ?? [];
  const labelById = new Map((session?.connections ?? []).map((c) => [c.id, c.label]));
  const hostWidth = Math.max(
    4,
    ...models.map((m) => String(m.provider_label || labelById.get(m.provider_id) || m.provider_id || "—").length),
  );
  const tierWidth = Math.max(8, ...models.map((m) => String(m.tier).length));
  out();
  for (const model of models) {
    const host = model.provider_label || labelById.get(model.provider_id) || model.provider_id || "—";
    const mark = model.id === data.baseline_model ? color(ANSI.yellow, "  baseline") : "";
    out(
      `  ${color(ANSI.dim, String(model.tier).padEnd(tierWidth + 2))}${color(ANSI.cyan, String(host).padEnd(hostWidth + 2))}${model.id}${mark}`,
    );
  }
  out();
  if (session?.connections?.length) {
    out(color(ANSI.dim, `  ${session.connections.length} host(s) · ${models.length} models`));
    out();
  }
}

async function cmdSavings(flags) {
  const config = readConfig();
  const apiKey = requireKey(flags, config);
  const data = await request("/v1/savings", { gatewayURL: gateway(flags, config), apiKey });
  out();
  out(`${color(ANSI.bold, usd(data.saved_usd))} saved  ${color(ANSI.dim, `(${Number(data.saved_pct || 0).toFixed(1)}%)`)}`);
  out();
  out(`  routed      ${usd(data.actual_usd)}`);
  out(`  baseline    ${usd(data.baseline_usd)}`);
  out(`  routing     ${usd(data.routing_saved_usd)}`);
  out(`  cache       ${usd(data.cache_saved_usd)}`);
  out(`  requests    ${data.requests}`);
  out();
}

async function interactive(flags) {
  if (!input.isTTY || !output.isTTY) {
    help();
    return;
  }

  const config = readConfig();
  const version = (() => {
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      return JSON.parse(readFileSync(join(here, "../package.json"), "utf8")).version;
    } catch {
      return "0.0.0";
    }
  })();

  let session = null;
  try {
    session = await loadSession(flags, config);
  } catch (error) {
    banner(null, version);
    out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
    out(color(ANSI.dim, "  Run: promptimizer login --key pmz_live_…"));
    out();
    return;
  }

  banner(session, version);

  const rl = createInterface({ input, output, terminal: true });
  const history = [];

  const slashHelp = () => {
    out();
    out(`  ${color(ANSI.bold, "/help")}                          this list`);
    out(`  ${color(ANSI.bold, "/hosts")}                         connected hosts`);
    out(`  ${color(ANSI.bold, "/models")}                        fleet + host + tier`);
    out(`  ${color(ANSI.bold, "/connect <host> --key …")}        add a host (keeps others)`);
    out(`  ${color(ANSI.bold, "/disconnect <host>")}             remove a host`);
    out(`  ${color(ANSI.bold, "/savings")}                       account ledger`);
    out(`  ${color(ANSI.bold, "/session")}                       provider status`);
    out(`  ${color(ANSI.bold, "/clear")}                         clear chat history`);
    out(`  ${color(ANSI.bold, "/logout")}                        remove saved API key and exit`);
    out(`  ${color(ANSI.bold, "/quit")}                          exit`);
    out();
  };

  try {
    while (true) {
      let line;
      try {
        line = await rl.question(color(ANSI.cyan, "› "));
      } catch {
        break;
      }
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "/quit" || trimmed === "/exit" || trimmed === "/q") break;

      if (trimmed === "/help" || trimmed === "/?") {
        slashHelp();
        continue;
      }

      if (trimmed === "/clear") {
        history.length = 0;
        out(color(ANSI.dim, "  History cleared."));
        out();
        continue;
      }

      if (trimmed === "/logout" || trimmed === "/signout") {
        cmdLogout();
        break;
      }

      if (trimmed === "/session") {
        try {
          session = await loadSession(flags, readConfig());
          out();
          out(`  ${hostSummary(session)} · ${session.mode}`);
          if (session.connections?.length) {
            for (const c of session.connections) {
              const count = session.models.filter((m) => m.provider_id === c.id).length;
              out(`  ${color(ANSI.green, "✓")} ${c.label} · ${count} models`);
            }
          } else {
            out(`  ${session.base_url}`);
          }
          out(`  ${session.models.length} models · baseline ${session.baseline_model}`);
          out();
        } catch (error) {
          out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
        }
        continue;
      }

      if (trimmed === "/hosts" || trimmed === "/providers") {
        try {
          session = await cmdHosts(flags);
        } catch (error) {
          out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
        }
        continue;
      }

      if (trimmed === "/models") {
        try {
          await cmdModels(flags);
        } catch (error) {
          out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
        }
        continue;
      }

      if (trimmed === "/savings") {
        try {
          await cmdSavings(flags);
        } catch (error) {
          out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
        }
        continue;
      }

      if (
        trimmed.startsWith("/connect") ||
        trimmed.startsWith("/add ") ||
        trimmed === "/add" ||
        trimmed.startsWith("/disconnect") ||
        trimmed.startsWith("/remove") ||
        trimmed.startsWith("/rm ")
      ) {
        const body = trimmed.replace(/^\/(connect|add|disconnect|remove|rm)\s*/i, "");
        const { flags: slashFlags, positional } = parseLineArgs(body);
        const mergedFlags = { ...flags, ...slashFlags };
        const isDisconnect = /^\/(disconnect|remove|rm)\b/i.test(trimmed);
        try {
          session = isDisconnect
            ? await cmdDisconnect(mergedFlags, positional)
            : await cmdConnect(mergedFlags, positional);
        } catch (error) {
          out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
          out();
        }
        continue;
      }

      if (trimmed.startsWith("/")) {
        out(color(ANSI.dim, "  Unknown command. Try /help"));
        continue;
      }

      history.push({ role: "user", content: trimmed });
      out();
      out(color(ANSI.magenta, "✦"));
      try {
        const { text, result } = await completeStream(flags, readConfig(), history);
        printAnswer(text);
        history.push({ role: "assistant", content: text });
        out();
        printMeta(result);
        out();
      } catch (error) {
        process.stdout.write("\n");
        history.pop();
        out(color(ANSI.yellow, `  ${error instanceof Error ? error.message : String(error)}`));
        out();
      }
    }
  } finally {
    rl.close();
    out();
    out(color(ANSI.dim, "  bye"));
    out();
  }
}

async function main() {
  const { flags, positional } = parse(process.argv.slice(2));
  if (flags.version || flags.v || positional[0] === "version") {
    printVersion();
    return;
  }
  if (positional[0] === "help") {
    if (positional[1]) commandHelp(positional[1]);
    else help();
    return;
  }
  if (flags.help || flags.h) {
    if (positional[0]) commandHelp(positional[0]);
    else help();
    return;
  }

  if (positional.length === 0) {
    return interactive(flags);
  }

  const [command, ...rest] = positional;
  try {
    if (command === "login") return await cmdLogin(flags);
    if (command === "logout") return cmdLogout();
    if (command === "providers") return await cmdProviders(flags);
    if (command === "connect" || command === "add") return await cmdConnect(flags, rest);
    if (command === "disconnect" || command === "remove" || command === "rm") {
      return await cmdDisconnect(flags, rest);
    }
    if (command === "hosts") return await cmdHosts(flags);
    if (command === "chat") return await cmdChat(flags, rest);
    if (command === "models") return await cmdModels(flags);
    if (command === "savings") return await cmdSavings(flags);
    if (command === "repl" || command === "i") return await interactive(flags);
  } catch (error) {
    die(error instanceof Error ? error.message : String(error));
  }
  die(`Unknown command "${command}". Run promptimizer --help.`);
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)));
