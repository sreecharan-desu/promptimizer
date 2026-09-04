#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = process.env.PROMPTIMIZER_URL || "https://hackathon-omega-liart.vercel.app/api";
const CONFIG_PATH = join(homedir(), ".promptimizer", "config.json");

const COMMANDS = [
  ["login", "Save a Promptimizer API key"],
  ["logout", "Remove the saved key"],
  ["connect", "Attach a model provider"],
  ["chat", "Route a completion"],
  ["models", "List the connected fleet"],
  ["savings", "Show account savings"],
  ["providers", "List known provider URLs"],
];

const COMMAND_HELP = {
  login: [
    "Usage",
    "  promptimizer login --key <pmz_live_...>",
    "",
    "Save a key from /account. Stored in ~/.promptimizer/config.json.",
    "",
    "Options",
    "  --key, -k     Promptimizer API key",
    "  --url, -u     Gateway URL",
  ],
  logout: ["Usage", "  promptimizer logout", "", "Deletes ~/.promptimizer/config.json."],
  connect: [
    "Usage",
    "  promptimizer connect <provider> --key <vendor-key>",
    "  promptimizer connect custom --base-url <url> --key <vendor-key>",
    "  promptimizer connect simulator",
    "",
    "Attach a provider to the signed-in account. Known hosts do not need --base-url.",
    "",
    "Options",
    "  --key, -k       Provider API key (or $BASETEN_API_KEY, $GROQ_API_KEY, …)",
    "  --base-url      Required for custom",
    "  --pmz           Promptimizer key (else the saved login)",
    "  --url, -u       Gateway URL",
  ],
  chat: [
    "Usage",
    '  promptimizer chat "<prompt>"',
    "",
    "Route one completion through the connected provider.",
    "",
    "Options",
    "  --prompt        Prompt text",
    "  --pmz           Promptimizer key (else the saved login)",
    "  --url, -u       Gateway URL",
  ],
  models: [
    "Usage",
    "  promptimizer models",
    "",
    "List chat models on the current session.",
    "",
    "Options",
    "  --url, -u       Gateway URL",
  ],
  savings: [
    "Usage",
    "  promptimizer savings",
    "",
    "Print routed spend versus the frontier baseline.",
    "",
    "Options",
    "  --key, -k       Promptimizer API key",
    "  --url, -u       Gateway URL",
  ],
  providers: [
    "Usage",
    "  promptimizer providers",
    "",
    "Print known provider ids and base URLs.",
    "",
    "Options",
    "  --url, -u       Gateway URL",
  ],
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

function help() {
  const width = Math.max(...COMMANDS.map(([name]) => name.length));
  out("Usage: promptimizer [--url <gateway>] <command> [options]");
  out();
  out("Route prompts through Promptimizer. Create a key at /account.");
  out();
  out("Commands");
  for (const [name, desc] of COMMANDS) out(`  ${name.padEnd(width + 2)}${desc}`);
  out();
  out("Global options");
  out("  --url, -u     Gateway URL (default: hosted app, or $PROMPTIMIZER_URL)");
  out("  --help, -h    Show help");
  out("  --version, -v Print version");
  out();
  out("Run `promptimizer <command> --help` for command flags.");
  out();
  out("Examples");
  out("  promptimizer login --key pmz_live_…");
  out("  promptimizer connect baseten --key $BASETEN_API_KEY");
  out('  promptimizer chat "What is 17 * 24?"');
  out("  promptimizer savings");
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
    die(detail);
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

async function cmdLogin(flags) {
  const apiKey = flags.key || flags.k || process.env.PROMPTIMIZER_API_KEY;
  if (!apiKey) die("Missing --key. Create one at /account.");
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  await request("/v1/session", { apiKey, gatewayURL });
  writeConfig({ ...config, gatewayURL, apiKey });
  out(`Saved  ${gatewayURL}`);
}

function cmdLogout() {
  rmSync(CONFIG_PATH, { force: true });
  out("Forgot saved key.");
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
  if (!provider && !baseURL) die("Usage: promptimizer connect <provider>\n       promptimizer connect custom --base-url https://…");

  const mock = provider === "simulator" || provider === "mock";
  let vendorKey = flags.key || flags.k;
  if (!mock && !baseURL && provider && provider !== "custom") {
    const catalog = await request("/v1/providers", { gatewayURL });
    const found = (catalog.data ?? []).find(
      (row) => row.id === provider || String(row.label).toLowerCase() === provider.toLowerCase(),
    );
    if (!found) die(`Unknown provider "${provider}". Run promptimizer providers, or pass --base-url.`);
    if (!vendorKey && found.env && process.env[found.env]) vendorKey = process.env[found.env];
    if (!vendorKey && found.id !== "ollama") {
      die(`Missing API key for ${found.label}. Pass --key or set ${found.env}.`);
    }
  } else if (!mock && !vendorKey && provider !== "ollama") {
    die("Missing provider key. Pass --key.");
  }

  const apiKey = flags.pmz || process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  const session = await request("/v1/providers/connect", {
    method: "POST",
    gatewayURL,
    apiKey,
    body: mock
      ? { mode: "mock", label: "Promptimizer simulator" }
      : {
          mode: "byok",
          provider: provider && provider !== "custom" ? provider : undefined,
          base_url: baseURL,
          api_key: vendorKey,
        },
  });

  writeConfig({ ...config, gatewayURL, apiKey, sessionId: session.session_id });
  out(`${session.label}  ${session.base_url}`);
  out(`${session.models.length} models · baseline ${session.baseline_model}`);
}

async function cmdChat(flags, positional) {
  const config = readConfig();
  const prompt = String(flags.prompt || positional.join(" ")).trim();
  if (!prompt) die('Usage: promptimizer chat "What is 17 * 24?"');
  const gatewayURL = gateway(flags, config);
  const apiKey = flags.pmz || process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  const sessionId = apiKey ? undefined : config.sessionId;
  if (!apiKey && !sessionId) die("Run promptimizer login or promptimizer connect first.");

  const result = await request("/v1/chat/completions", {
    method: "POST",
    gatewayURL,
    apiKey,
    sessionId,
    body: { messages: [{ role: "user", content: prompt }] },
  });
  const text = result.choices?.[0]?.message?.content?.trim() ?? "";
  const meta = result.promptimizer ?? {};
  const saved = result.usage?.cost?.saved_usd;
  out();
  out(text);
  out();
  const bits = [meta.model || result.model, meta.tier].filter(Boolean);
  if (saved != null) bits.push(`saved ${usd(saved)}`);
  if (meta.cache_hit) bits.push("cache");
  if (meta.escalated) bits.push("escalated");
  out(bits.join("  ·  "));
  out();
}

async function cmdModels(flags) {
  const config = readConfig();
  const gatewayURL = gateway(flags, config);
  const apiKey = process.env.PROMPTIMIZER_API_KEY || config.apiKey;
  const sessionId = apiKey ? undefined : config.sessionId;
  if (!apiKey && !sessionId) die("Run promptimizer login or promptimizer connect first.");
  const data = await request("/v1/models", { gatewayURL, apiKey, sessionId });
  const models = data.data ?? [];
  const width = Math.max(8, ...models.map((model) => String(model.tier).length));
  out();
  for (const model of models) {
    const mark = model.id === data.baseline_model ? "  baseline" : "";
    out(`  ${String(model.tier).padEnd(width + 2)}${model.id}${mark}`);
  }
  out();
}

async function cmdSavings(flags) {
  const config = readConfig();
  const apiKey = requireKey(flags, config);
  const data = await request("/v1/savings", { gatewayURL: gateway(flags, config), apiKey });
  out();
  out(`${usd(data.saved_usd)} saved`);
  out();
  out(`  routed      ${usd(data.actual_usd)}`);
  out(`  baseline    ${usd(data.baseline_usd)}`);
  out(`  routing     ${usd(data.routing_saved_usd)}`);
  out(`  cache       ${usd(data.cache_saved_usd)}`);
  out(`  requests    ${data.requests}`);
  out();
}

function printVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));
  out(pkg.version);
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
  if (positional.length === 0) {
    help();
    return;
  }

  const [command, ...rest] = positional;
  if (flags.help || flags.h) {
    commandHelp(command);
    return;
  }
  if (command === "login") return cmdLogin(flags);
  if (command === "logout") return cmdLogout();
  if (command === "providers") return cmdProviders(flags);
  if (command === "connect") return cmdConnect(flags, rest);
  if (command === "chat") return cmdChat(flags, rest);
  if (command === "models") return cmdModels(flags);
  if (command === "savings") return cmdSavings(flags);
  die(`Unknown command "${command}". Run promptimizer --help.`);
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)));
