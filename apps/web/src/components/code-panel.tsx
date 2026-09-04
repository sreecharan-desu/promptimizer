"use client";

import { useState } from "react";

const SAMPLES: Record<string, string> = {
  TypeScript: `import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  gatewayURL: process.env.PROMPTIMIZER_URL,
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});

const res = await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});

console.log(res.model, res.usage.cost?.saved_pct);`,
  Python: `import httpx

r = httpx.post(
    "https://your-host/api/v1/chat/completions",
    headers={"Authorization": f"Bearer {PROMPTIMIZER_API_KEY}"},
    json={"messages": [{"role": "user", "content": "What is 17 * 24?"}]},
).json()

print(r["promptimizer"]["tier"], r["usage"]["cost"]["saved_pct"])`,
  cURL: `curl -s https://your-host/api/v1/chat/completions \\
  -H "Authorization: Bearer $PROMPTIMIZER_API_KEY" \\
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
