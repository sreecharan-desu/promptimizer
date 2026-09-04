"use client";

import { useEffect, useMemo, useState } from "react";
import { api, clearSessionId, readSessionId, writeSessionId, type Session } from "@/lib/api";
import { EmptySpot } from "@/components/spot";

const PRESETS = [
  { label: "Simulator", mode: "mock" as const, base_url: "" },
  { label: "OpenAI", mode: "byok" as const, base_url: "https://api.openai.com/v1" },
  { label: "Groq", mode: "byok" as const, base_url: "https://api.groq.com/openai/v1" },
  { label: "OpenRouter", mode: "byok" as const, base_url: "https://openrouter.ai/api/v1" },
  { label: "Together", mode: "byok" as const, base_url: "https://api.together.xyz/v1" },
  { label: "Fireworks", mode: "byok" as const, base_url: "https://api.fireworks.ai/inference/v1" },
  { label: "DeepSeek", mode: "byok" as const, base_url: "https://api.deepseek.com/v1" },
  { label: "Ollama", mode: "byok" as const, base_url: "http://localhost:11434/v1" },
  { label: "Custom", mode: "byok" as const, base_url: "" },
];

type Bench = Awaited<ReturnType<typeof api.benchmark>>;

export function ConsoleApp() {
  const [tab, setTab] = useState<"connect" | "fleet" | "play" | "bench">("connect");
  const [preset, setPreset] = useState(PRESETS[0]);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("What is the capital of France?");
  const [completion, setCompletion] = useState<Record<string, unknown> | null>(null);
  const [bench, setBench] = useState<Bench | null>(null);

  useEffect(() => {
    const existing = readSessionId();
    if (!existing) return;
    api
      .session()
      .then((s) => {
        setSession(s);
        setTab("fleet");
      })
      .catch(() => clearSessionId());
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const next = await api.connect({
        mode: preset.mode,
        label: preset.label,
        base_url: preset.mode === "mock" ? undefined : baseUrl || preset.base_url,
        api_key: preset.mode === "mock" ? undefined : apiKey,
      });
      writeSessionId(next.session_id);
      setSession(next);
      setTab("fleet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(id: string, tier: string) {
    if (!session) return;
    const next = await api.patchModels({ overrides: { [id]: tier } });
    setSession(next);
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.chat([{ role: "user", content: prompt }]);
      setCompletion(result as Record<string, unknown>);
      const refreshed = await api.session();
      setSession(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function runBench() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.benchmark();
      setBench(result);
      setTab("bench");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Benchmark failed");
    } finally {
      setBusy(false);
    }
  }

  const meta = completion?.promptimizer as Record<string, unknown> | undefined;
  const usage = completion?.usage as { cost?: Record<string, number> } | undefined;
  const answer = useMemo(() => {
    const choices = completion?.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content ?? "";
  }, [completion]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium tracking-wide text-accent">CONSOLE</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">
        Bring a key. Watch the route.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-secondary">
        Simulator needs nothing. BYOK fetches every chat model from your OpenAI-compatible endpoint and tiers them
        for cost.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {(
          [
            ["connect", "Connect"],
            ["fleet", "Fleet"],
            ["play", "Playground"],
            ["bench", "Benchmark"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              tab === id ? "bg-primary text-background" : "text-primary/60 hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-6 text-sm text-error">{error}</p> : null}

      {tab === "connect" ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <EmptySpot />
            <p className="text-center text-sm text-secondary">Keys never hit localStorage. Sessions expire.</p>
          </div>
          <div className="rounded-2xl border border-primary/[0.06] bg-card p-6">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setPreset(item);
                    setBaseUrl(item.base_url);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    preset.label === item.label
                      ? "bg-accent text-background"
                      : "text-primary/60 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {preset.mode === "byok" ? (
              <div className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-primary">
                  Base URL
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="mt-2 h-11 w-full rounded-lg border border-primary/15 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </label>
                <label className="block text-sm font-medium text-primary">
                  API key
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="mt-2 h-11 w-full rounded-lg border border-primary/15 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </label>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-relaxed text-secondary">
                Three mocked tiers: nano, flash, frontier. Hard questions fail on cheap models on purpose — so the
                quality gate has something real to measure.
              </p>
            )}
            <button
              type="button"
              onClick={connect}
              disabled={busy}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Connecting…" : preset.mode === "mock" ? "Start simulator" : "Fetch models"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "fleet" && session ? (
        <div className="mt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-secondary">
                {session.label} · {session.models.length} chat models · baseline {session.baseline_model}
              </p>
            </div>
            <button type="button" onClick={runBench} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background">
              Run benchmark
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-primary/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="bg-card text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Input / 1M</th>
                  <th className="px-4 py-3 font-medium">Output / 1M</th>
                </tr>
              </thead>
              <tbody>
                {session.models.map((model) => (
                  <tr key={model.id} className="border-t border-primary/5">
                    <td className="px-4 py-3 font-mono text-[13px] text-primary">{model.id}</td>
                    <td className="px-4 py-3">
                      <select
                        value={model.tier}
                        onChange={(e) => changeTier(model.id, e.target.value)}
                        className="rounded-md border border-primary/15 bg-background px-2 py-1 text-sm"
                      >
                        <option value="economy">economy</option>
                        <option value="standard">standard</option>
                        <option value="frontier">frontier</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-secondary tabular">{model.input_per_1m ?? "—"}</td>
                    <td className="px-4 py-3 text-secondary tabular">{model.output_per_1m ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "play" && session ? (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-primary/15 bg-card px-4 py-3 text-sm leading-relaxed text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Routing…" : "Route this prompt"}
            </button>
            {answer ? (
              <div className="mt-6 rounded-xl border border-primary/[0.06] bg-card p-5 text-sm leading-relaxed text-primary">
                {answer}
              </div>
            ) : null}
          </div>
          <aside className="rounded-2xl border border-primary/[0.06] bg-card p-5 text-sm">
            <p className="text-xs font-medium tracking-wide text-secondary">ROUTE</p>
            {meta ? (
              <dl className="mt-4 space-y-3">
                <Row k="Model" v={String(meta.model)} />
                <Row k="Tier" v={String(meta.tier)} />
                <Row k="Complexity" v={`L${meta.complexity} · ${meta.category}`} />
                <Row k="Cache" v={meta.cache_hit ? "hit" : "miss"} />
                <Row k="Quality gate" v={String(meta.quality_gate)} />
                <Row k="Escalated" v={meta.escalated ? "yes" : "no"} />
                <Row k="Saved" v={`${Number(usage?.cost?.saved_pct ?? 0).toFixed(1)}%`} accent />
              </dl>
            ) : (
              <p className="mt-4 text-secondary">Send a prompt to see classification, cache, and cost.</p>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "bench" ? (
        <div className="mt-10">
          {!bench ? (
            <div className="rounded-2xl border border-primary/[0.06] bg-card p-10 text-center">
              <p className="text-secondary">Run the fixed 15-task set against the current fleet.</p>
              <button
                type="button"
                onClick={runBench}
                disabled={busy || !session}
                className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
              >
                {busy ? "Scoring…" : "Run benchmark"}
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <Stat label="Saved vs always-frontier" value={`${Number(bench.summary.saved_pct).toFixed(1)}%`} accent />
                <Stat label="Routed quality" value={Number(bench.summary.avg_quality_routed).toFixed(2)} />
                <Stat label="Frontier quality" value={Number(bench.summary.avg_quality_frontier).toFixed(2)} />
                <Stat label="Quality delta" value={Number(bench.summary.quality_delta).toFixed(2)} />
              </div>
              <p className="mt-4 text-sm text-secondary">
                Quality delta near zero is the point. Cheap on easy tasks. Frontier on hard ones. Escalations:{" "}
                {bench.summary.escalations}.
              </p>
              <div className="mt-8 overflow-x-auto rounded-2xl border border-primary/[0.06]">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-card text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">L</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Saved</th>
                      <th className="px-4 py-3 font-medium">Q routed</th>
                      <th className="px-4 py-3 font-medium">Q frontier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bench.rows.map((row) => (
                      <tr key={row.id} className="border-t border-primary/5">
                        <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                        <td className="px-4 py-3">{row.difficulty}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                        <td className="px-4 py-3 text-accent tabular">{Number(row.cost.saved_pct).toFixed(0)}%</td>
                        <td className="px-4 py-3 tabular">{Number(row.quality_routed.score).toFixed(2)}</td>
                        <td className="px-4 py-3 tabular">{Number(row.quality_frontier.score).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab !== "connect" && !session ? (
        <p className="mt-10 text-sm text-secondary">Connect a provider first.</p>
      ) : null}
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-secondary">{k}</dt>
      <dd className={accent ? "text-accent" : "text-primary"}>{v}</dd>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-primary/[0.06] bg-card p-5">
      <p className={`font-display text-3xl font-medium tracking-tight ${accent ? "text-accent" : "text-primary"}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-secondary">{label}</p>
    </div>
  );
}
