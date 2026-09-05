"use client";

import { useState, type ReactNode } from "react";

const HOST = "https://hackathon-omega-liart.vercel.app";

const TABS = ["TypeScript", "CLI", "cURL"] as const;
type Tab = (typeof TABS)[number];

const COPY: Record<Tab, string> = {
  TypeScript: `import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});

const res = await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});

console.log(res.choices[0].message.content);
console.log(res.usage.cost);`,
  CLI: `npx promptimizer-cli login --key pmz_live_…
npx promptimizer-cli connect baseten --key "$BASETEN_API_KEY"
npx promptimizer-cli chat "What is 17 * 24?"
npx promptimizer-cli savings`,
  cURL: `curl -s ${HOST}/api/v1/chat/completions \\
  -H "Authorization: Bearer $PROMPTIMIZER_API_KEY" \\
  -H 'content-type: application/json' \\
  -d '{"messages":[{"role":"user","content":"What is 17 * 24?"}]}'`,
};

function kw(s: string) {
  return <span className="tok-kw">{s}</span>;
}
function str(s: string) {
  return <span className="tok-str">{s}</span>;
}
function fn(s: string) {
  return <span className="tok-fn">{s}</span>;
}
function prop(s: string) {
  return <span className="tok-prop">{s}</span>;
}
function num(s: string) {
  return <span className="tok-num">{s}</span>;
}

const TS_LINES: ReactNode[] = [
  <>
    {kw("import")} {"{ "}
    {fn("Promptimizer")}
    {" } "}
    {kw("from")} {str('"promptimizer"')};
  </>,
  <></>,
  <>
    {kw("const")} client = {kw("new")} {fn("Promptimizer")}
    {"({"}
  </>,
  <>
    {"  "}
    {prop("apiKey")}: process.{prop("env")}.{prop("PROMPTIMIZER_API_KEY")},
  </>,
  <>{"});"}</>,
  <></>,
  <>
    {kw("const")} res = {kw("await")} client.{prop("chat")}.{prop("completions")}.{fn("create")}
    {"({"}
  </>,
  <>
    {"  "}
    {prop("messages")}: [{"{"} {prop("role")}: {str('"user"')}, {prop("content")}: {str('"What is 17 * 24?"')} {"}"}],
  </>,
  <>{"});"}</>,
  <></>,
  <>
    console.{fn("log")}(res.{prop("choices")}[{num("0")}].{prop("message")}.{prop("content")});
  </>,
  <>
    console.{fn("log")}(res.{prop("usage")}.{prop("cost")});
  </>,
];

const CURL_LINES: ReactNode[] = [
  <>
    {fn("curl")} -s {str(`${HOST}/api/v1/chat/completions`)} \
  </>,
  <>
    {"  "}-H {str('"Authorization: Bearer $PROMPTIMIZER_API_KEY"')} \
  </>,
  <>
    {"  "}-H {str("'content-type: application/json'")} \
  </>,
  <>
    {"  "}-d {str(`'{"messages":[{"role":"user","content":"What is 17 * 24?"}]}'`)}
  </>,
];

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="size-2.5 rounded-full bg-[#FF5F57]" />
      <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="size-2.5 rounded-full bg-[#28C840]" />
    </div>
  );
}

function EditorBody({ lines, start = 1 }: { lines: ReactNode[]; start?: number }) {
  return (
    <div className="code-editor-body overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[12.5px] leading-[1.7] sm:text-[13px]">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="code-line">
              <td className="code-gutter select-none pr-4 text-right align-top">{start + i}</td>
              <td className="code-src whitespace-pre pr-5 align-top">{line}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TerminalBody() {
  return (
    <div className="code-term-body overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-[1.75] sm:text-[13px]">
      <p>
        <span className="tok-prompt">➜</span> <span className="tok-path">~</span>{" "}
        <span className="tok-cmd">npx promptimizer-cli login --key pmz_live_…</span>
      </p>
      <p className="tok-out">Signed in.</p>
      <p>
        <span className="tok-prompt">➜</span> <span className="tok-path">~</span>{" "}
        <span className="tok-cmd">npx promptimizer-cli connect baseten --key &quot;$BASETEN_API_KEY&quot;</span>
      </p>
      <p className="tok-out">
        Connected · Baseten · <span className="tok-num">16</span> models
      </p>
      <p>
        <span className="tok-prompt">➜</span> <span className="tok-path">~</span>{" "}
        <span className="tok-cmd">npx promptimizer-cli chat &quot;What is 17 * 24?&quot;</span>
      </p>
      <p className="tok-out">
        <span className="tok-str">408</span>
      </p>
      <p className="tok-dim">economy · thinkingmachines/inkling-small · saved $0.00012</p>
      <p>
        <span className="tok-prompt">➜</span> <span className="tok-path">~</span>{" "}
        <span className="tok-cmd">npx promptimizer-cli savings</span>
      </p>
      <p className="tok-out">
        saved vs always-frontier · see <span className="tok-cmd">savings</span> for live totals
      </p>
      <p>
        <span className="tok-prompt">➜</span> <span className="tok-path">~</span>{" "}
        <span className="tok-cursor">▋</span>
      </p>
    </div>
  );
}

export function CodePanel() {
  const [tab, setTab] = useState<Tab>("TypeScript");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(COPY[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const isTerm = tab === "CLI";
  const title = tab === "TypeScript" ? "route.ts" : tab === "CLI" ? "zsh — promptimizer" : "request.sh";

  return (
    <div className="code-window overflow-hidden rounded-xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
      <div className="code-titlebar flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5">
        <TrafficLights />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0 overflow-x-auto">
            {isTerm ? (
              <span className="code-file-tab active truncate px-3 py-1 text-[12px]">{title}</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTab("TypeScript")}
                  className={`code-file-tab truncate px-3 py-1 text-[12px] ${tab === "TypeScript" ? "active" : ""}`}
                >
                  route.ts
                </button>
                <button
                  type="button"
                  onClick={() => setTab("cURL")}
                  className={`code-file-tab truncate px-3 py-1 text-[12px] ${tab === "cURL" ? "active" : ""}`}
                >
                  request.sh
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                tab === name ? "bg-white/[0.08] text-[#E8E8E8]" : "text-[#8B8B8B] hover:text-[#D0D0D0]"
              }`}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="ml-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-[#8B8B8B] transition-colors hover:bg-white/[0.06] hover:text-[#D0D0D0]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {tab === "TypeScript" ? <EditorBody lines={TS_LINES} /> : null}
      {tab === "cURL" ? <EditorBody lines={CURL_LINES} /> : null}
      {tab === "CLI" ? <TerminalBody /> : null}
    </div>
  );
}
