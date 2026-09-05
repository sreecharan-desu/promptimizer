"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVIDERS } from "promptimizer";
import { api, clearSessionId, readSessionId, writeSessionId, type Session } from "@/lib/api";
import {
  clearConsoleCache,
  fleetKey,
  restoreForSession,
  writeConsoleCache,
} from "@/lib/console-cache";
import { EmptyFleetSpot, KeySpot } from "./console-spots";
import { Donut, Meter, Pill, usd } from "./metrics";
import { ModelIcon, ProviderIcon } from "./provider-icon";

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
  ["eval", "Eval"],
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
  const [benchCachedAt, setBenchCachedAt] = useState<number | null>(null);

  const host = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
  const hosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HOSTS;
    return HOSTS.filter((h) => h.label.toLowerCase().includes(q) || h.id.includes(q) || h.base_url.toLowerCase().includes(q));
  }, [query]);

  function persist(next: {
    session: Session;
    bench?: Bench | null;
    completion?: Record<string, unknown> | null;
    prompt?: string;
    tab?: Tab;
    benchAt?: number | null;
  }) {
    writeConsoleCache({
      fleetKey: fleetKey(next.session),
      sessionId: next.session.session_id,
      bench: next.bench === undefined ? bench : next.bench,
      completion: next.completion === undefined ? completion : next.completion,
      prompt: next.prompt === undefined ? prompt : next.prompt,
      tab: next.tab === undefined ? tab : next.tab,
      benchAt: next.benchAt === undefined ? benchCachedAt : next.benchAt,
    });
  }

  useEffect(() => {
    api
      .session()
      .then((s) => {
        writeSessionId(s.session_id);
        setSession(s);
        const cached = restoreForSession(s);
        if (cached) {
          if (cached.bench) setBench(cached.bench as Bench);
          if (cached.completion) setCompletion(cached.completion);
          if (cached.prompt) setPrompt(cached.prompt);
          if (cached.benchAt) setBenchCachedAt(cached.bench ? cached.benchAt : null);
          const restoredTab = TABS.some(([id]) => id === cached.tab) ? (cached.tab as Tab) : "fleet";
          setTab(restoredTab === "connect" && s.models.length ? "fleet" : restoredTab);
        } else {
          setTab("fleet");
        }
      })
      .catch(() => {
        if (readSessionId()) clearSessionId();
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    writeConsoleCache({
      fleetKey: fleetKey(session),
      sessionId: session.session_id,
      bench,
      completion,
      prompt,
      tab,
      benchAt: benchCachedAt,
    });
  }, [session, bench, completion, prompt, tab, benchCachedAt]);

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
      setBenchCachedAt(null);
      setApiKey("");
      setTab("fleet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectHost(providerId: string) {
    setBusy(true);
    setError(null);
    try {
      const next = await api.disconnect({ provider: providerId });
      writeSessionId(next.session_id);
      setSession(next);
      setCompletion(null);
      setBench(null);
      setBenchCachedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(id: string, tier: string) {
    if (!session) return;
    const next = await api.patchModels({ overrides: { [id]: tier } });
    setSession(next);
    setBench(null);
    setBenchCachedAt(null);
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

  const meta = completion?.promptimizer as Record<string, unknown> | undefined;
  const usage = completion?.usage as { cost?: Record<string, number> } | undefined;
  const answer = useMemo(() => {
    const choices = completion?.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content ?? "";
  }, [completion]);

  const hasFleet = Boolean(session?.models?.length);
  const tabMeta = hasFleet
    ? `${session!.label} · ${session!.models.length} models`
    : "Connect an OpenAI-compatible host to begin.";
  const tabLabel = TABS.find(([id]) => id === tab)?.[1] ?? "Console";

  return (
    <div className="console-shell relative mx-auto min-h-[calc(100vh-5rem)] max-w-7xl">
      {/* Floating side dock — not a full-height sidebar */}
      <aside
        className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:bottom-auto lg:left-4 lg:top-[calc(50%+0.5rem)] lg:translate-x-0 lg:-translate-y-1/2"
        aria-label="Console"
      >
        <nav className="console-dock pointer-events-auto flex flex-row gap-1 rounded-[1.85rem] border border-primary/[0.07] bg-card/95 p-1.5 shadow-[0_22px_60px_-32px_rgba(0,0,0,0.55)] backdrop-blur-md lg:flex-col lg:gap-1.5 lg:p-2">
          {TABS.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(id)}
                className={`group relative flex size-11 items-center justify-center rounded-[1.15rem] transition-all duration-200 ease-out ${
                  active
                    ? "bg-primary text-background shadow-[0_8px_20px_-12px_rgba(0,0,0,0.55)]"
                    : "text-primary/40 hover:bg-primary/[0.05] hover:text-primary"
                }`}
              >
                <DockIcon tab={id} className={`size-5 transition-transform duration-200 ${active ? "scale-100" : "group-hover:scale-105"}`} />
                <span className="sr-only">{label}</span>
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-primary px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 lg:block">
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main stage — offset for the floating dock */}
      <div className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:py-8 lg:pl-[5.75rem] lg:pr-8 lg:pb-10">
        <header className="console-rise mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-display text-3xl font-medium tracking-tight text-primary">Console</h1>
              <span className="rounded-full bg-primary/[0.06] px-2.5 py-0.5 text-[12px] font-medium text-primary/70">
                {tabLabel}
              </span>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-secondary">{tabMeta}</p>
          </div>
          {session?.baseline_model ? (
            <div className="max-w-sm rounded-2xl border border-primary/[0.06] bg-card/80 px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-medium uppercase tracking-wide text-secondary">Baseline</p>
              <div className="mt-1 flex items-center gap-2">
                <ModelIcon modelId={session.baseline_model} className="size-4 shrink-0" />
                <p className="truncate font-mono text-[11px] text-primary/75">{session.baseline_model}</p>
              </div>
            </div>
          ) : null}
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-error/20 bg-error/[0.06] px-3 py-2 text-sm text-error">{error}</p>
        ) : null}

        <div key={tab} className="console-rise console-rise-delay">
          {tab === "connect" ? (
            <ConnectPane
              busy={busy}
              host={host}
              hosts={hosts}
              query={query}
              baseUrl={baseUrl}
              apiKey={apiKey}
              connectedIds={new Set((session?.connections ?? []).map((c) => c.id))}
              fleetSummary={
                hasFleet
                  ? `${session!.label} · ${session!.models.length} models across ${session!.connections?.length ?? 1} host(s)`
                  : null
              }
              onQuery={setQuery}
              onPick={(item) => {
                setHostId(item.id);
                setBaseUrl(item.base_url);
              }}
              onBaseUrl={setBaseUrl}
              onKey={setApiKey}
              onFetch={connectKey}
              onDisconnect={disconnectHost}
            />
          ) : null}

          {tab === "fleet" ? (
            hasFleet ? (
              <FleetPane session={session!} onTier={changeTier} />
            ) : (
              <NeedSession onConnect={() => setTab("connect")} />
            )
          ) : null}

          {tab === "play" ? (
            hasFleet ? (
              <PlayPane
                session={session!}
                prompt={prompt}
                answer={answer}
                meta={meta}
                usage={usage}
                busy={busy}
                onPrompt={setPrompt}
                onSend={send}
              />
            ) : (
              <NeedSession onConnect={() => setTab("connect")} />
            )
          ) : null}

          {tab === "eval" ? (
            hasFleet ? <EvalPane /> : <NeedSession onConnect={() => setTab("connect")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DockIcon({ tab, className }: { tab: Tab; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (tab === "connect") {
    return (
      <svg {...common}>
        <path d="M8 12h8" />
        <path d="M10 8H7a3 3 0 0 0 0 8h3" />
        <path d="M14 8h3a3 3 0 0 1 0 8h-3" />
      </svg>
    );
  }
  if (tab === "fleet") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (tab === "eval") {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 15l3.5-5 2.5 3 4-7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4.5 18.5V7.2A2.2 2.2 0 0 1 6.7 5h7.1A2.2 2.2 0 0 1 16 7.2v6.1a2.2 2.2 0 0 1-2.2 2.2H8.2L4.5 18.5z" />
      <path d="M9 10h4.5M9 13h2.5" />
    </svg>
  );
}

function EvalPane() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bench, setBench] = useState<Bench | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.benchmark();
      setBench(result as Bench);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval failed");
    } finally {
      setBusy(false);
    }
  }

  const metrics = (bench as { metrics?: Record<string, unknown> } | null)?.metrics;
  const summary = (bench as { summary?: Record<string, number> } | null)?.summary;
  const curve = (metrics?.frontier_curve as Array<{ frontier_call_pct: number; quality: number }> | undefined) ?? [];
  const curveOff =
    (metrics?.frontier_curve_gate_off as Array<{ frontier_call_pct: number; quality: number }> | undefined) ?? [];
  const op = metrics?.operating_point as { frontier_call_pct?: number; quality?: number } | undefined;
  const byDiff = metrics?.by_difficulty as Record<string, { avg_routed?: number; worst_regression?: number }> | undefined;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Eval</p>
            <p className="mt-1 font-display text-xl font-medium text-primary">PGR · APGR · CPT · frontier</p>
            <p className="mt-1 max-w-xl text-sm text-secondary">
              Run the fixed task set with a real policy prefix and separate exact/prefix cache stats. Cost is never shown alone.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Running…" : "Run eval"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      </section>

      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricMini label="PGR" value={fmtNum(metrics?.pgr)} hint="1.0 = matched frontier" />
          <MetricMini label="APGR" value={fmtNum(metrics?.apgr)} hint="Area under call–performance" />
          <MetricMini label="CPT(50%)" value={pct01(metrics?.cpt_50)} hint="Frontier calls for half the gap" />
          <MetricMini label="CPT(80%)" value={pct01(metrics?.cpt_80)} hint="Frontier calls for most of the gap" />
          <MetricMini label="API spend" value={usd(summary.actual_usd ?? 0)} hint={`Saved ${usd(summary.saved_usd ?? 0)}`} />
          <MetricMini
            label="Escalation"
            value={pct01(summary.escalation_rate)}
            hint={`Break-even ${pct01(summary.break_even_escalation_rate)}`}
          />
          <MetricMini label="Exact cache" value={pct01(summary.exact_cache_hit_rate)} hint="Full replay" />
          <MetricMini label="Prefix cache" value={pct01(summary.prefix_cache_hit_rate)} hint="Shared policy block" />
        </div>
      ) : null}

      {curve.length > 1 ? (
        <section className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Cost–quality frontier</p>
          <p className="mt-1 text-sm text-secondary">Green = gate on · amber = gate off · red mark = operating point</p>
          <FrontierChart gateOn={curve} gateOff={curveOff} operating={op} />
        </section>
      ) : null}

      {byDiff ? (
        <section className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">By difficulty</p>
          <p className="mt-1 text-sm text-secondary">Worst regression per bucket — averages hide hard collapses.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["easy", "medium", "hard"] as const).map((key) => (
              <div key={key} className="rounded-xl border border-primary/[0.06] px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-secondary">{key}</p>
                <p className="mt-1 font-display text-lg text-primary tabular">
                  {fmtNum(byDiff[key]?.avg_routed)}
                </p>
                <p className={`mt-1 text-sm tabular ${(byDiff[key]?.worst_regression ?? 0) < 0 ? "text-red-500" : "text-secondary"}`}>
                  worst Δ {fmtNum(byDiff[key]?.worst_regression)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricMini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-primary tabular">{value}</p>
      {hint ? <p className="mt-1 text-xs text-secondary">{hint}</p> : null}
    </div>
  );
}

function fmtNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}

function pct01(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(0)}%` : "—";
}

function FrontierChart({
  gateOn,
  gateOff,
  operating,
}: {
  gateOn: Array<{ frontier_call_pct: number; quality: number }>;
  gateOff: Array<{ frontier_call_pct: number; quality: number }>;
  operating?: { frontier_call_pct?: number; quality?: number };
}) {
  const w = 420;
  const h = 180;
  const pad = 28;
  const xs = gateOn.map((p) => p.frontier_call_pct);
  const ys = [...gateOn, ...gateOff].map((p) => p.quality);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const x = (v: number) => pad + v * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - minY) / (maxY - minY || 1)) * (h - pad * 2);
  const path = (pts: Array<{ frontier_call_pct: number; quality: number }>) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.frontier_call_pct)},${y(p.quality)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full max-w-xl" role="img" aria-label="Cost quality frontier">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.15} />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" strokeOpacity={0.15} />
      <path d={path(gateOn)} fill="none" stroke="hsl(var(--accent))" strokeWidth={2.5} />
      <path d={path(gateOff)} fill="none" stroke="#D4A017" strokeWidth={2} strokeDasharray="5 4" />
      {operating && operating.frontier_call_pct != null && operating.quality != null ? (
        <circle
          cx={x(operating.frontier_call_pct)}
          cy={y(operating.quality)}
          r={5}
          fill="#E25555"
        />
      ) : null}
      <text x={w / 2} y={h - 6} textAnchor="middle" className="fill-current text-[10px]" fillOpacity={0.45}>
        % frontier calls
      </text>
      <text x={12} y={h / 2} textAnchor="middle" className="fill-current text-[10px]" fillOpacity={0.45} transform={`rotate(-90 12 ${h / 2})`}>
        quality
      </text>
    </svg>
  );
}

function ConnectPane({
  busy,
  host,
  hosts,
  query,
  baseUrl,
  apiKey,
  connectedIds,
  fleetSummary,
  onQuery,
  onPick,
  onBaseUrl,
  onKey,
  onFetch,
  onDisconnect,
}: {
  busy: boolean;
  host: (typeof HOSTS)[number];
  hosts: typeof HOSTS;
  query: string;
  baseUrl: string;
  apiKey: string;
  connectedIds: Set<string>;
  fleetSummary: string | null;
  onQuery: (v: string) => void;
  onPick: (item: (typeof HOSTS)[number]) => void;
  onBaseUrl: (v: string) => void;
  onKey: (v: string) => void;
  onFetch: () => void;
  onDisconnect: (providerId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Step 01</p>
            <h2 className="mt-1 font-display text-xl font-medium tracking-tight text-primary">Your keys</h2>
            <p className="mt-1 max-w-xl text-sm text-secondary">
              Connect hosts one at a time. Checkmarks stay — fetch another to merge fleets. Routing picks across all.
            </p>
            {fleetSummary ? <p className="mt-2 text-sm text-primary">{fleetSummary}</p> : null}
          </div>
          <div className="hidden sm:block">
            <KeySpot />
          </div>
        </div>

        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Filter hosts" className={FIELD} />

        <div className="mt-3 flex flex-wrap gap-2">
          {hosts.map((item) => {
            const active = item.id === host.id;
            const connected = connectedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-primary text-background"
                    : connected
                      ? "text-primary shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.45)]"
                      : "text-primary/50 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)] hover:text-primary"
                }`}
              >
                <ProviderIcon id={item.id} className="size-3.5" invert={active} />
                {item.label}
                {connected ? <span aria-hidden="true" className="text-[11px] opacity-80">✓</span> : null}
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
          <p className="mt-5 flex items-center gap-2 truncate font-mono text-[13px] text-secondary">
            <ProviderIcon id={host.id} className="size-4 shrink-0" />
            <span className="truncate">{host.base_url}</span>
          </p>
        )}

        <label className="mt-4 block text-sm text-secondary">
          API key{connectedIds.has(host.id) ? " (reconnect to refresh models)" : ""}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onKey(e.target.value)}
            placeholder={host.hint || "sk-..."}
            className={FIELD}
          />
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onFetch}
            disabled={busy || !apiKey.trim() || (host.id === "custom" && !baseUrl.trim())}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Fetching…" : connectedIds.has(host.id) ? "Refresh models" : "Fetch models"}
          </button>
          {connectedIds.has(host.id) ? (
            <button
              type="button"
              onClick={() => onDisconnect(host.id)}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-full border border-primary/15 px-4 text-sm font-medium text-primary disabled:opacity-50"
            >
              Remove host
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FleetPane({
  session,
  onTier,
}: {
  session: Session;
  onTier: (id: string, tier: string) => void;
}) {
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(0);

  const tiers = useMemo(() => {
    const counts = { economy: 0, standard: 0, frontier: 0 };
    for (const m of session.models) {
      if (!m.selected) continue;
      if (m.tier in counts) counts[m.tier as keyof typeof counts] += 1;
    }
    return counts;
  }, [session.models]);
  const selected = session.models.filter((m) => m.selected).length;
  const hostCounts = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    for (const m of session.models) {
      const id = m.provider_id ?? "provider";
      const label =
        m.provider_label ||
        session.connections?.find((c) => c.id === id)?.label ||
        id;
      const prev = map.get(id);
      map.set(id, { id, label, count: (prev?.count ?? 0) + 1 });
    }
    if (session.connections?.length) {
      for (const c of session.connections) {
        if (!map.has(c.id)) map.set(c.id, { id: c.id, label: c.label, count: 0 });
      }
    }
    return [...map.values()];
  }, [session.models, session.connections]);

  const total = session.models.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageModels = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return session.models.slice(start, start + PAGE_SIZE);
  }, [session.models, safePage]);

  useEffect(() => {
    setPage(0);
  }, [session.session_id, total]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const rangeStart = total === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (safePage + 1) * PAGE_SIZE);

  function hostFor(model: Session["models"][number]) {
    return (
      model.provider_label ||
      session.connections?.find((c) => c.id === model.provider_id)?.label ||
      model.provider_id ||
      "—"
    );
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.35)] lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-secondary">
                {session.models.length} chat models · baseline{" "}
                <span className="break-all font-mono text-primary">{session.baseline_model ?? "—"}</span>
              </p>
              <p className="mt-1 text-sm text-secondary">
                Change a tier if the auto-map is wrong. Quality shows ~estimates; measured scores appear for models that
                have been scored.
              </p>
              {hostCounts.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {hostCounts.map((h) => (
                    <span
                      key={h.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/[0.08] bg-background px-2.5 py-1 text-[11px] text-primary"
                    >
                      <ProviderIcon id={h.id} className="size-3.5" />
                      {h.label}
                      <span className="text-secondary">{h.count}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="rounded-[1.35rem] border border-primary/[0.06] bg-card p-5 shadow-[0_16px_40px_-36px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Selected mix</p>
          <div className="mt-3 flex items-center gap-4">
            <Donut
              size={72}
              thickness={11}
              slices={[
                { label: "economy", value: tiers.economy, color: "hsl(var(--accent))" },
                { label: "standard", value: tiers.standard, color: "hsl(var(--primary) / 0.45)" },
                { label: "frontier", value: tiers.frontier, color: "hsl(var(--primary) / 0.2)" },
              ]}
              center={<span className="font-display text-sm font-medium text-primary">{selected}</span>}
            />
            <ul className="space-y-1 text-xs text-secondary">
              <li>economy {tiers.economy}</li>
              <li>standard {tiers.standard}</li>
              <li>frontier {tiers.frontier}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {pageModels.map((model) => {
          const host = hostFor(model);
          return (
            <li
              key={`${model.provider_id ?? "x"}:${model.id}`}
              className="rounded-2xl border border-primary/[0.06] bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <ModelIcon modelId={model.id} providerId={model.provider_id} className="mt-0.5 size-5 shrink-0" />
                  <p className="min-w-0 break-all font-mono text-[13px] text-primary">{model.id}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/[0.06] px-2 py-0.5 text-[11px] text-secondary">
                  <ProviderIcon id={model.provider_id || host} className="size-3" />
                  {host}
                </span>
              </div>
              <div className="mt-3">
                <TierPicker value={model.tier} onPick={(tier) => onTier(model.id, tier)} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-secondary">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-secondary/80">Input / 1M</dt>
                  <dd className="mt-0.5 tabular text-primary">{fmtPer1m(model.input_per_1m)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-secondary/80">Output / 1M</dt>
                  <dd className="mt-0.5 tabular text-primary">{fmtPer1m(model.output_per_1m)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-secondary/80">Context</dt>
                  <dd className="mt-0.5 tabular text-primary">{fmtContext(model.context_length)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-secondary/80">Price</dt>
                  <dd className="mt-0.5 text-primary">{fmtPriceSource(model)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[10px] uppercase tracking-wide text-secondary/80">Quality</dt>
                  <dd className={`mt-0.5 tabular ${fmtQuality(model).measured ? "text-primary" : "text-secondary"}`}>
                    {fmtQuality(model).label}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet: scrollable table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-primary/[0.06] md:block">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-card text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Host</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Input / 1M</th>
              <th className="px-4 py-3 font-medium">Output / 1M</th>
              <th className="px-4 py-3 font-medium">Context</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Quality</th>
            </tr>
          </thead>
          <tbody>
            {pageModels.map((model) => {
              const host = hostFor(model);
              return (
                <tr key={`${model.provider_id ?? "x"}:${model.id}`} className="border-t border-primary/5">
                  <td className="max-w-[280px] px-4 py-3 font-mono text-[13px] text-primary">
                    <span className="inline-flex items-start gap-2.5">
                      <ModelIcon modelId={model.id} providerId={model.provider_id} className="mt-0.5 size-5 shrink-0" />
                      <span className="break-all">{model.id}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      <ProviderIcon id={model.provider_id || host} className="size-3.5" />
                      {host}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TierPicker value={model.tier} onPick={(tier) => onTier(model.id, tier)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary tabular">
                    {fmtPer1m(model.input_per_1m)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary tabular">
                    {fmtPer1m(model.output_per_1m)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary tabular">
                    {fmtContext(model.context_length)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-secondary">{fmtPriceSource(model)}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 tabular ${
                      fmtQuality(model).measured ? "text-primary" : "text-secondary"
                    }`}
                    title={fmtQuality(model).measured ? "Measured from benchmark" : "Tier estimate — run benchmark"}
                  >
                    {fmtQuality(model).label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">
            <span className="tabular text-primary">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="min-w-[4.5rem] text-center text-sm tabular text-secondary">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TierPicker({
  value,
  onPick,
}: {
  value: string;
  onPick: (tier: "economy" | "standard" | "frontier") => void;
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-full border border-primary/[0.08] p-0.5">
      {(["economy", "standard", "frontier"] as const).map((tier) => (
        <button
          key={tier}
          type="button"
          onClick={() => onPick(tier)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
            value === tier ? "bg-primary text-background" : "text-primary/50 hover:text-primary"
          }`}
        >
          {tier}
        </button>
      ))}
    </div>
  );
}

function fmtPer1m(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(3)}`;
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(1)}`;
}

function fmtContext(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1024) {
    const k = n / 1024;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return n.toLocaleString();
}

function fmtPriceSource(model: Session["models"][number]) {
  if (model.pricing_source === "estimate" || model.pricing_known === false) return "est.";
  if (model.pricing_source === "catalog" || model.pricing_source === "provider") return "known";
  if (model.input_per_1m != null) return "known";
  return "—";
}

/** Measured quality after benchmark; otherwise a tier heuristic so the column is never blank. */
function fmtQuality(model: Session["models"][number]): { label: string; measured: boolean } {
  if (model.overall_quality != null && Number.isFinite(model.overall_quality)) {
    return { label: `${Math.round(model.overall_quality * 100)}%`, measured: true };
  }
  const byTier = { economy: 0.68, standard: 0.82, frontier: 0.94 } as const;
  const est = byTier[model.tier] ?? 0.75;
  return { label: `~${Math.round(est * 100)}%`, measured: false };
}

function cheapestSelected(session: Session, tier: "economy" | "standard" | "frontier") {
  const pool = session.models.filter((m) => m.selected && m.tier === tier);
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    const ba = (a.input_per_1m ?? 2) * 0.4 + (a.output_per_1m ?? 6) * 0.6;
    const bb = (b.input_per_1m ?? 2) * 0.4 + (b.output_per_1m ?? 6) * 0.6;
    return ba - bb;
  })[0];
}

function PlayPane({
  session,
  prompt,
  answer,
  meta,
  usage,
  busy,
  onPrompt,
  onSend,
}: {
  session: Session;
  prompt: string;
  answer: string;
  meta?: Record<string, unknown>;
  usage?: { cost?: Record<string, number> };
  busy: boolean;
  onPrompt: (v: string) => void;
  onSend: () => void;
}) {
  const quality =
    meta && typeof meta.quality === "object" && meta.quality && "score" in (meta.quality as object)
      ? Number((meta.quality as { score: number }).score)
      : null;

  const rows = useMemo(() => {
    const chosenTier = String(meta?.tier ?? "");
    const chosenModel = String(meta?.model ?? "");
    return (["economy", "standard", "frontier"] as const).map((tier) => {
      const model =
        chosenTier === tier
          ? session.models.find((m) => m.id === chosenModel) ?? cheapestSelected(session, tier)
          : cheapestSelected(session, tier);
      const selected = Boolean(meta) && chosenTier === tier;
      let decision: "Selected" | "Alternate" | "Skipped" | "Unavailable" = "Unavailable";
      if (!model) decision = "Unavailable";
      else if (!meta) decision = "Skipped";
      else if (selected) decision = "Selected";
      else if (tier === "standard" && chosenTier === "economy") decision = "Alternate";
      else if (tier === "frontier" && chosenTier !== "frontier") decision = "Alternate";
      else decision = "Skipped";
      return { tier, model: selected && chosenModel ? session.models.find((m) => m.id === chosenModel) ?? model : model, decision, selected };
    });
  }, [meta, session.models]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
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
              <p className="mt-3 text-sm leading-relaxed text-primary whitespace-pre-wrap">{answer}</p>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-primary/[0.06] bg-card p-5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Incoming request</p>
            {busy ? <Pill tone="warn">Live</Pill> : meta ? <Pill tone="good">Routed</Pill> : <Pill>Idle</Pill>}
          </div>
          {meta ? (
            <dl className="mt-4 space-y-3">
              <Row k="Category" v={String(meta.category ?? "—")} />
              <Row k="Complexity" v={`L${meta.complexity}`} />
              <Row
                k="Difficulty"
                v={
                  Number(meta.complexity) >= 4 ? "Hard" : Number(meta.complexity) >= 3 ? "Medium" : "Easy"
                }
              />
              <Row
                k="Cache"
                v={
                  meta.exact_cache_hit
                    ? "exact"
                    : meta.prompt_cache_hit
                      ? "prompt"
                      : meta.semantic_cache_hit
                        ? `similar ${meta.semantic_cache_mode ?? ""}${
                            meta.semantic_similarity != null
                              ? ` ${Math.round(Number(meta.semantic_similarity) * 100)}%`
                              : ""
                          }`.trim()
                        : meta.prefix_cache_hit
                          ? "prefix"
                          : "miss"
                }
              />
              <Row k="Policy" v={String(meta.routing_policy ?? "bootstrap_heuristic")} />
              <Row k="P(quality|small)" v={meta.p_small_quality != null ? Number(meta.p_small_quality).toFixed(2) : "—"} />
              <Row
                k="Quality gate"
                v={
                  meta.quality_audit
                    ? `${meta.quality_gate}${meta.quality_audit_pass === false ? " · audit fail" : " · audited"}`
                    : String(meta.quality_gate)
                }
              />
              {meta.escalated ? <Row k="Escalation" v={String(meta.escalation_reason ?? "yes")} /> : null}
              {quality != null ? (
                <div>
                  <div className="flex justify-between text-secondary">
                    <dt>Quality</dt>
                    <dd className="text-primary tabular">{Math.round(quality * 100)}%</dd>
                  </div>
                  <Meter value={quality * 100} className="mt-2" />
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-4 text-secondary">Send a prompt. Classification and cost land here.</p>
          )}
        </aside>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/[0.06]">
        <div className="border-b border-primary/[0.06] bg-card px-4 py-3">
          <p className="font-display text-lg font-medium text-primary">
            {busy ? "Evaluating across model tiers…" : meta ? "Routing decision" : "Tier evaluation"}
          </p>
          <p className="mt-1 text-sm text-secondary">
            Cheapest selected model per tier. The router picks the adequate tier, then escalates only if quality fails.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Est. cost / 1M</th>
                <th className="px-4 py-3 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tier} className={`border-t border-primary/5 ${row.selected ? "bg-accent/[0.06]" : ""}`}>
                  <td className="px-4 py-3 capitalize text-primary">{row.tier}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-primary">{row.model?.id ?? "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {row.tier === "economy"
                      ? "Cheap adequate"
                      : row.tier === "standard"
                        ? "Balanced"
                        : "Baseline / frontier"}
                  </td>
                  <td className="px-4 py-3 tabular text-secondary">
                    {row.model
                      ? `$${(row.model.input_per_1m ?? "—")}/${(row.model.output_per_1m ?? "—")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        row.decision === "Selected"
                          ? "good"
                          : row.decision === "Alternate"
                            ? "warn"
                            : row.decision === "Unavailable"
                              ? "bad"
                              : "neutral"
                      }
                    >
                      {row.decision}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta ? (
          <div className="grid gap-4 border-t border-primary/[0.06] bg-card px-4 py-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-secondary">Decision</p>
              <p className="mt-1 text-sm font-medium text-primary">
                {String(meta.model)} · {String(meta.tier)}
                {meta.escalated ? " · escalated" : ""}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-secondary">API cost</p>
              <p className="mt-1 text-sm font-medium text-primary tabular">{usd(Number(usage?.cost?.actual_usd ?? 0))}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-secondary">Saved</p>
              <p className="mt-1 text-sm font-medium text-accent tabular">
                {Number(usage?.cost?.saved_pct ?? 0).toFixed(1)}% · {usd(Number(usage?.cost?.saved_usd ?? 0))}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-secondary">Latency</p>
              <p className="mt-1 text-sm font-medium text-primary tabular">
                {meta.latency_ms != null ? `${Math.round(Number(meta.latency_ms))} ms` : "—"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NeedSession({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/[0.06] bg-card">
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="p-8">
          <h2 className="font-display text-2xl font-medium tracking-tight text-primary">No fleet yet</h2>
          <p className="mt-3 max-w-md text-secondary">Connect an OpenAI-compatible provider key to discover models and start routing.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onConnect}
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background"
            >
              Connect a host
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
