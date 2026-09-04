"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVIDERS } from "promptimizer";
import { api, clearSessionId, readSessionId, writeSessionId, type PolicySummary, type Session } from "@/lib/api";
import { BenchSpot, EmptyFleetSpot, KeySpot, SimulatorSpot } from "./console-spots";

const HOSTS = [
  ...PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    base_url: p.baseURL,
    hint: p.hint,
  })),
  { id: "custom", label: "Custom", base_url: "", hint: "sk-..." },
];

const EXAMPLES = [
  { label: "Factual", prompt: "What is the capital of France?" },
  { label: "Math", prompt: "What is 17 * 24?" },
  { label: "Hard", prompt: "Design a rate limiter for 1 million QPS across 50 regions. Discuss Redis and failure modes." },
];

const TABS = [
  ["connect", "Connect"],
  ["fleet", "Fleet"],
  ["play", "Playground"],
  ["bench", "Benchmark"],
] as const;

const FIELD =
  "mt-2 h-11 w-full rounded-xl border border-primary/15 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent";

type Tab = (typeof TABS)[number][0];
type Bench = Awaited<ReturnType<typeof api.benchmark>>;

export function ConsoleApp() {
  const [tab, setTab] = useState<Tab>("connect");
  const [hostId, setHostId] = useState("baseten");
  const [query, setQuery] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(EXAMPLES[0].prompt);
  const [completion, setCompletion] = useState<Record<string, unknown> | null>(null);
  const [bench, setBench] = useState<Bench | null>(null);

  const host = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
  const hosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HOSTS;
    return HOSTS.filter((h) => h.label.toLowerCase().includes(q) || h.id.includes(q) || h.base_url.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    api
      .session()
      .then((s) => {
        writeSessionId(s.session_id);
        setSession(s);
        setTab("fleet");
      })
      .catch(() => {
        if (readSessionId()) clearSessionId();
      });
  }, []);

  async function connectSimulator() {
    setBusy(true);
    setError(null);
    try {
      const next = await api.connect({ mode: "mock", label: "Simulator" });
      writeSessionId(next.session_id);
      setSession(next);
      setCompletion(null);
      setBench(null);
      setTab("fleet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function connectKey() {
    setBusy(true);
    setError(null);
    try {
      const custom = host.id === "custom";
      const next = await api.connect({
        mode: "byok",
        label: host.label,
        provider: custom ? undefined : host.id,
        base_url: custom ? baseUrl : undefined,
        api_key: apiKey,
      });
      writeSessionId(next.session_id);
      setSession(next);
      setCompletion(null);
      setBench(null);
      setTab("fleet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(id: string, tier: string) {
    if (!session) return;
    setSession(await api.patchModels({ overrides: { [id]: tier } }));
  }

  async function send() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.chat([{ role: "user", content: prompt }]);
      setCompletion(result as Record<string, unknown>);
      setSession(await api.session());
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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-primary">Console</h1>
          <p className="mt-2 text-secondary">
            {session
              ? `${session.label} · ${session.models.length} models · baseline ${session.baseline_model ?? "—"}`
              : "Start the simulator, or connect a vendor key."}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-primary/[0.08] bg-card/60 p-0.5">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                tab === id ? "bg-primary text-background" : "text-primary/50 hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-6 text-sm text-error">{error}</p> : null}

      {tab === "connect" ? (
        <ConnectPane
          busy={busy}
          host={host}
          hosts={hosts}
          query={query}
          baseUrl={baseUrl}
          apiKey={apiKey}
          onQuery={setQuery}
          onPick={(item) => {
            setHostId(item.id);
            setBaseUrl(item.base_url);
          }}
          onBaseUrl={setBaseUrl}
          onKey={setApiKey}
          onSimulator={connectSimulator}
          onFetch={connectKey}
        />
      ) : null}

      {tab === "fleet" ? (
        session ? (
          <FleetPane session={session} busy={busy} onTier={changeTier} onBench={runBench} />
        ) : (
          <NeedSession onSimulator={connectSimulator} onConnect={() => setTab("connect")} busy={busy} />
        )
      ) : null}

      {tab === "play" ? (
        session ? (
          <PlayPane
            prompt={prompt}
            answer={answer}
            meta={meta}
            usage={usage}
            busy={busy}
            onPrompt={setPrompt}
            onSend={send}
          />
        ) : (
          <NeedSession onSimulator={connectSimulator} onConnect={() => setTab("connect")} busy={busy} />
        )
      ) : null}

      {tab === "bench" ? (
        session ? (
          <BenchPane bench={bench} busy={busy} onRun={runBench} />
        ) : (
          <NeedSession onSimulator={connectSimulator} onConnect={() => setTab("connect")} busy={busy} />
        )
      ) : null}
    </div>
  );
}

function ConnectPane({
  busy,
  host,
  hosts,
  query,
  baseUrl,
  apiKey,
  onQuery,
  onPick,
  onBaseUrl,
  onKey,
  onSimulator,
  onFetch,
}: {
  busy: boolean;
  host: (typeof HOSTS)[number];
  hosts: typeof HOSTS;
  query: string;
  baseUrl: string;
  apiKey: string;
  onQuery: (v: string) => void;
  onPick: (item: (typeof HOSTS)[number]) => void;
  onBaseUrl: (v: string) => void;
  onKey: (v: string) => void;
  onSimulator: () => void;
  onFetch: () => void;
}) {
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col rounded-2xl border border-primary/[0.06] bg-card p-6">
        <SimulatorSpot />
        <h2 className="mt-5 font-display text-2xl font-medium tracking-tight text-primary">Simulator</h2>
        <p className="mt-2 text-sm text-secondary">Three mocked models. No vendor key.</p>
        <dl className="mt-5 space-y-3">
          {[
            ["promptimizer-nano", "economy"],
            ["promptimizer-flash", "standard"],
            ["promptimizer-frontier", "frontier"],
          ].map(([model, tier]) => (
            <div key={model} className="flex items-center justify-between gap-4 border-b border-primary/5 pb-3">
              <dt className="font-mono text-[13px] text-primary">{model}</dt>
              <dd className="text-sm text-secondary">{tier}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onSimulator}
          disabled={busy}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start simulator"}
        </button>
      </section>

      <section className="flex flex-col rounded-2xl border border-primary/[0.06] bg-card p-6">
        <KeySpot />
        <h2 className="mt-5 font-display text-2xl font-medium tracking-tight text-primary">Your key</h2>
        <p className="mt-2 text-sm text-secondary">Pick a host, paste the key. Custom is the only one that asks for a URL.</p>

        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Filter hosts" className={FIELD} />

        <div className="mt-3 flex flex-wrap gap-2">
          {hosts.map((item) => {
            const active = item.id === host.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-primary text-background"
                    : "text-primary/50 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)] hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {host.id === "custom" ? (
          <label className="mt-5 block text-sm text-secondary">
            Base URL
            <input
              value={baseUrl}
              onChange={(e) => onBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className={FIELD}
            />
          </label>
        ) : (
          <p className="mt-5 truncate font-mono text-[13px] text-secondary">{host.base_url}</p>
        )}

        <label className="mt-4 block text-sm text-secondary">
          API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onKey(e.target.value)}
            placeholder={host.hint || "sk-..."}
            className={FIELD}
          />
        </label>

        <button
          type="button"
          onClick={onFetch}
          disabled={busy || !apiKey.trim() || (host.id === "custom" && !baseUrl.trim())}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Fetching…" : "Fetch models"}
        </button>
      </section>
    </div>
  );
}

function FleetPane({
  session,
  busy,
  onTier,
  onBench,
}: {
  session: Session;
  busy: boolean;
  onTier: (id: string, tier: string) => void;
  onBench: () => void;
}) {
  return (
    <div className="mt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-secondary">{session.models.length} chat models. Change a tier if the auto-map is wrong.</p>
        <button
          type="button"
          onClick={onBench}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {busy ? "Scoring…" : "Run benchmark"}
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
                  <div className="inline-flex rounded-full border border-primary/[0.08] p-0.5">
                    {(["economy", "standard", "frontier"] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => onTier(model.id, tier)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
                          model.tier === tier ? "bg-primary text-background" : "text-primary/50 hover:text-primary"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-secondary tabular">{model.input_per_1m ?? "—"}</td>
                <td className="px-4 py-3 text-secondary tabular">{model.output_per_1m ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayPane({
  prompt,
  answer,
  meta,
  usage,
  busy,
  onPrompt,
  onSend,
}: {
  prompt: string;
  answer: string;
  meta?: Record<string, unknown>;
  usage?: { cost?: Record<string, number> };
  busy: boolean;
  onPrompt: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onPrompt(item.prompt)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                prompt === item.prompt
                  ? "bg-primary text-background"
                  : "text-primary/50 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)] hover:text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
          rows={8}
          className="mt-4 w-full rounded-xl border border-primary/15 bg-card px-4 py-3 text-sm leading-relaxed text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-secondary">⌘ Enter</p>
          <button
            type="button"
            onClick={onSend}
            disabled={busy || !prompt.trim()}
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Routing…" : "Send"}
          </button>
        </div>
        {answer ? (
          <div className="mt-6 rounded-xl border border-primary/[0.06] bg-card p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Answer</p>
            <p className="mt-3 text-sm leading-relaxed text-primary">{answer}</p>
          </div>
        ) : null}
      </div>
      <aside className="rounded-2xl border border-primary/[0.06] bg-card p-5 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">This request</p>
        {meta ? (
          <dl className="mt-4 space-y-3">
            <Row k="Model" v={String(meta.model)} />
            <Row k="Tier" v={String(meta.tier)} />
            <Row k="Complexity" v={`L${meta.complexity} · ${meta.category}`} />
            <Row k="P(quality|small)" v={meta.p_small_quality != null ? Number(meta.p_small_quality).toFixed(2) : "—"} />
            <Row k="Cache" v={meta.cache_hit ? "hit" : "miss"} />
            <Row k="Quality gate" v={String(meta.quality_gate)} />
            <Row k="Escalated" v={meta.escalated ? "yes" : "no"} />
            <Row k="Saved" v={`${Number(usage?.cost?.saved_pct ?? 0).toFixed(1)}%`} accent />
          </dl>
        ) : (
          <p className="mt-4 text-secondary">Send a prompt. Classification, cache, and cost land here.</p>
        )}
      </aside>
    </div>
  );
}

function BenchPane({ bench, busy, onRun }: { bench: Bench | null; busy: boolean; onRun: () => void }) {
  if (!bench) {
    return (
      <div className="mt-10 overflow-hidden rounded-2xl border border-primary/[0.06] bg-card">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="p-8">
            <h2 className="font-display text-2xl font-medium tracking-tight text-primary">15 gold tasks</h2>
            <p className="mt-3 max-w-md text-secondary">
              Same prompts, four policies. Cost and quality versus always using the frontier model.
            </p>
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Scoring…" : "Run benchmark"}
            </button>
          </div>
          <div className="border-t border-primary/[0.06] bg-codeblock p-5 lg:border-l lg:border-t-0">
            <BenchSpot />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10">
      {bench.policies ? <PolicyBoard policies={bench.policies} /> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Saved vs always-frontier" value={`${Number(bench.summary.saved_pct).toFixed(1)}%`} accent />
        <Stat label="Routed quality" value={Number(bench.summary.avg_quality_routed).toFixed(2)} />
        <Stat
          label="Worst-case quality"
          value={Number(bench.summary.worst_quality_routed ?? bench.summary.avg_quality_routed).toFixed(2)}
        />
        <Stat label="Quality vs frontier" value={Number(bench.summary.quality_delta).toFixed(2)} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Routing savings" value={`$${(bench.summary.routing_saved_usd ?? 0).toFixed(5)}`} />
        <Stat label="Cache savings" value={`$${(bench.summary.cache_saved_usd ?? 0).toFixed(5)}`} accent />
        <Stat label="Cache hit rate" value={`${((bench.summary.cache_hit_rate ?? 0) * 100).toFixed(0)}%`} />
      </div>
      <p className="mt-4 text-sm text-secondary">
        Quality-aware + cache is the product. Escalated {bench.summary.escalations}
        {bench.summary.successful_escalations != null ? `, ${bench.summary.successful_escalations} recovered` : ""}.
      </p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-primary/[0.06]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-card text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">L</th>
              <th className="px-4 py-3 font-medium">P</th>
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
                <td className="px-4 py-3 tabular">
                  {row.p_small_quality != null ? Number(row.p_small_quality).toFixed(2) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                <td className="px-4 py-3 text-accent tabular">{Number(row.cost.saved_pct).toFixed(0)}%</td>
                <td className="px-4 py-3 tabular">{Number(row.quality_routed.score).toFixed(2)}</td>
                <td className="px-4 py-3 tabular">{Number(row.quality_frontier.score).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NeedSession({
  onSimulator,
  onConnect,
  busy,
}: {
  onSimulator: () => void;
  onConnect: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-primary/[0.06] bg-card">
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="p-8">
          <h2 className="font-display text-2xl font-medium tracking-tight text-primary">No fleet yet</h2>
          <p className="mt-3 max-w-md text-secondary">Start the simulator, or connect a vendor key.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSimulator}
              disabled={busy}
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start simulator"}
            </button>
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
            >
              Your key
            </button>
          </div>
        </div>
        <div className="border-t border-primary/[0.06] bg-codeblock p-5 lg:border-l lg:border-t-0">
          <EmptyFleetSpot />
        </div>
      </div>
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

const POLICY_LABEL: Record<string, string> = {
  always_frontier: "Always frontier",
  difficulty: "Difficulty router",
  quality: "Quality-aware",
  quality_cache: "Quality + cache",
};

function PolicyBoard({ policies }: { policies: Record<string, PolicySummary> }) {
  const order = ["always_frontier", "difficulty", "quality", "quality_cache"];
  const points = order
    .map((id) => policies[id])
    .filter(Boolean)
    .map((p) => ({ q: p.avg_quality, c: p.actual_usd }));
  const maxC = Math.max(...points.map((p) => p.c), 1e-9);
  const minQ = Math.min(...points.map((p) => p.q), 0.7);
  const maxQ = Math.max(...points.map((p) => p.q), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((id) => {
          const p = policies[id];
          if (!p) return null;
          return (
            <div key={id} className="rounded-2xl border border-primary/[0.06] bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{POLICY_LABEL[id] ?? id}</p>
              <p className="mt-2 font-display text-2xl font-medium text-primary">${p.actual_usd.toFixed(5)}</p>
              <p className="mt-1 text-sm text-secondary">
                Q {p.avg_quality.toFixed(2)} · worst {p.worst_quality.toFixed(2)} · saved {p.saved_pct.toFixed(0)}%
              </p>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-primary/[0.06] bg-card p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Quality vs cost</p>
        <svg viewBox="0 0 220 140" className="mt-3 h-36 w-full">
          <line x1="24" y1="12" x2="24" y2="120" stroke="currentColor" className="text-primary/20" />
          <line x1="24" y1="120" x2="208" y2="120" stroke="currentColor" className="text-primary/20" />
          {points.map((p, i) => {
            const x = 24 + (p.c / maxC) * 170;
            const y = 120 - ((p.q - minQ) / Math.max(0.001, maxQ - minQ)) * 96;
            return <circle key={order[i]} cx={x} cy={y} r="5" className={i === 3 ? "fill-accent" : "fill-primary/70"} />;
          })}
        </svg>
        <p className="text-xs text-secondary">Gold is quality-aware + cache. Left is cheaper. Up is higher quality.</p>
      </div>
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
