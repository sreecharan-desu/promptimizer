"use client";

import { useState } from "react";

const SAMPLES: Record<string, string> = {
  TypeScript: `import { Promptimizer } from "promptimizer";

const { client } = await Promptimizer.connect({
  gatewayURL: process.env.PROMPTIMIZER_URL,
  mode: "byok",
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const res = await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});

console.log(res.model, res.usage.cost?.saved_pct);`,
  Python: `import httpx

session = httpx.post("http://localhost:8000/v1/providers/connect", json={
    "mode": "byok",
    "base_url": "https://api.openai.com/v1",
    "api_key": OPENAI_API_KEY,
}).json()

r = httpx.post(
    "http://localhost:8000/v1/chat/completions",
    headers={"X-Promptimizer-Session": session["session_id"]},
    json={"messages": [{"role": "user", "content": "What is 17 * 24?"}]},
).json()

print(r["promptimizer"]["tier"], r["usage"]["cost"]["saved_pct"])`,
  cURL: `curl -s http://localhost:8000/v1/providers/connect \\
  -H 'content-type: application/json' \\
  -d '{"mode":"mock"}' | jq .session_id

curl -s http://localhost:8000/v1/chat/completions \\
  -H "X-Promptimizer-Session: $SESSION" \\
  -H 'content-type: application/json' \\
  -d '{"messages":[{"role":"user","content":"What is 17 * 24?"}]}'`,
};

export function CodePanel() {
  const tabs = Object.keys(SAMPLES);
  const [tab, setTab] = useState(tabs[0]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(SAMPLES[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-primary/[0.08] bg-card">
      <div className="flex items-center justify-between border-b border-primary/[0.06] px-4 py-2">
        <div className="flex gap-4">
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`text-sm font-medium transition-colors duration-150 ${
                tab === name ? "text-primary" : "text-secondary hover:text-primary"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="text-xs font-medium text-secondary hover:text-primary">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-codeblock p-4 text-[13px] leading-relaxed text-primary/80">
        <code className="font-mono">{SAMPLES[tab]}</code>
      </pre>
    </div>
  );
}
