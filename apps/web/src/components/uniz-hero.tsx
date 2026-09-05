import Link from "next/link";
import {
  Microscope,
  LayoutGrid,
  Terminal,
  TrendingUp,
  BarChart3,
  Search,
  Sparkles,
  Zap,
  Star,
  Trophy,
  CheckCircle2,
  FileText,
  Download,
  Activity,
  RefreshCw,
  ArrowRight,
  Apple,
  ShieldCheck,
  Cpu,
  ChevronRight,
} from "lucide-react";

export function UnizHero() {
  return (
    <section className="relative overflow-hidden bg-white dark:bg-[#0a0a0f] pt-14 pb-24 sm:pt-20 sm:pb-32">

      {/* Dot-grid texture overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.35,
        }}
      />
      {/* Radial fade to white at edges */}
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, white 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, #0a0a0f 100%)",
        }}
        aria-hidden="true"
      />

      {/* Main Centered Hero Header */}
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          OpenAI-Compatible BYOK Model Router
        </div>

        {/* Headline — two distinct weights, no single-word color accent */}
        <h1 className="mt-8 font-display text-[2.6rem] font-black tracking-[-0.045em] text-slate-950 dark:text-white sm:text-6xl lg:text-[4.5rem] leading-[1.02]">
          The better way to
          <br />
          <span className="font-light tracking-[-0.02em] text-slate-400 dark:text-slate-500">
            navigate model fleets.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400 sm:text-lg">
          Governance infrastructure for AI applications — model routing,
          semantic caching, and cost control in one unified layer.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-slate-950 px-7 text-sm font-semibold text-white shadow-lg ring-1 ring-slate-950/5 transition-all duration-150 hover:bg-slate-800 active:scale-[0.97] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Apple className="size-4" />
            Download for macOS
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-6 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition-all hover:ring-slate-300 dark:text-slate-400 dark:ring-slate-800 dark:hover:ring-slate-700"
          >
            View live demo <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 Feature Preview Cards */}
      <div className="relative mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 items-start">

          {/* Card 1: Live Routing Matrix — light */}
          <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70">
            {/* Mini preview */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-500">
                  <Activity className="size-3 text-emerald-500" />
                  Routing matrix
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live
                </span>
              </div>

              <div className="space-y-3">
                {[
                  { name: "Claude 3.5 Sonnet", pct: 94, w: "w-[94%]" },
                  { name: "GPT-4o mini", pct: 86, w: "w-[86%]" },
                  { name: "Llama 3.3 70B", pct: 72, w: "w-[72%]" },
                ].map((m) => (
                  <div key={m.name}>
                    <div className="flex justify-between mb-1 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                      <span>{m.name}</span>
                      <span className="tabular-nums">{m.pct}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full ${m.w} rounded-full bg-slate-900 dark:bg-slate-100`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  Alert below 20%
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  84.0% avg
                </span>
              </div>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="size-2.5" /> Live routing
              </span>
              <h3 className="mt-3 text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                Per-request routing
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Route intelligently across providers with cost thresholds and real-time model heatmaps.
              </p>
            </div>
          </div>

          {/* Card 2: Quality Scorecard — dark, taller */}
          <div className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-md transition-shadow duration-200 hover:shadow-xl lg:mt-[-1.25rem] lg:mb-[-1.25rem]">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center gap-1.5 mb-4">
                <Star className="size-3 text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-semibold tracking-wide text-slate-500">
                  Quality scorecard
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { val: "9.84", label: "PGR", accent: "text-white" },
                  { val: "8.98", label: "APGR", accent: "text-white" },
                  { val: "#01", label: "Rank", accent: "text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-slate-800/60 border border-slate-800 p-2.5">
                    <div className={`font-mono text-sm font-bold ${stat.accent}`}>{stat.val}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3.5 space-y-1.5">
                {[
                  { label: "Factual Accuracy", score: "5.0", status: "Pass" },
                  { label: "Schema Validation", score: "5.0", status: "Pass" },
                  { label: "Latency SLA", score: "4.9", status: "Pass" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-1.5 text-[10px] border border-slate-800"
                  >
                    <span className="text-slate-400">{row.label}</span>
                    <span className="font-bold text-emerald-400">{row.status} {row.score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/50 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                <Trophy className="size-2.5" /> Quality gate
              </span>
              <h3 className="mt-3 text-[15px] font-bold text-white leading-snug">
                Benchmark scorecard
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                PGR, APGR, and benchmark rank surfaced cleanly for every model evaluation.
              </p>
            </div>
          </div>

          {/* Card 3: Semantic Cache — light */}
          <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-500">
                  <Zap className="size-3 text-indigo-500" />
                  Semantic cache
                </span>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                  0 ms
                </span>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[9px] text-slate-400 mb-0.5">Incoming prompt</div>
                  <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
                    Summarize Q3 revenue…
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="mx-2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">0.98 similarity</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <div className="text-[9px] text-indigo-500 mb-0.5">Replayed from cache</div>
                  <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
                    Summarize Q3 earnings…
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-slate-900 py-1.5 text-center text-[9px] font-bold text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center gap-1">
                  <RefreshCw className="size-2.5" /> Instant replay
                </div>
                <div className="flex gap-1 items-center">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="size-1.5 rounded-full bg-indigo-500" />
                  <span className="size-1.5 rounded-full bg-amber-500" />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Zap className="size-2.5" /> Semantic cache
              </span>
              <h3 className="mt-3 text-[15px] font-bold text-slate-900 dark:text-white leading-snug">
                Zero-latency replay
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Auto-detect near-duplicate prompts and serve cached completions instantly — no LLM call.
              </p>
            </div>
          </div>

          {/* Card 4: Audit Reports — dark */}
          <div className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-md transition-shadow duration-200 hover:shadow-xl">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-500">
                  <FileText className="size-3" />
                  Audit report · Q3
                </span>
                <span className="text-[9px] text-slate-600">2024</span>
              </div>

              {/* Sparkline bars with better contrast + subtle labels */}
              <div className="flex items-end gap-1.5 h-14 px-1">
                {[
                  { h: "h-4", label: "Jul", color: "bg-slate-700" },
                  { h: "h-7", label: "Aug", color: "bg-slate-600" },
                  { h: "h-5", label: "Sep", color: "bg-slate-700" },
                  { h: "h-10", label: "Oct", color: "bg-slate-600" },
                  { h: "h-6", label: "Nov", color: "bg-slate-700" },
                  { h: "h-14", label: "Dec", color: "bg-emerald-500" },
                ].map((bar) => (
                  <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className={`w-full rounded-t ${bar.h} ${bar.color} transition-all`} />
                    <span className="text-[8px] text-slate-600">{bar.label}</span>
                  </div>
                ))}
              </div>

              <button className="mt-3.5 w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/50 py-2 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">
                <Download className="size-3" />
                Download audit PDF
              </button>
            </div>

            <div className="mt-5">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                <FileText className="size-2.5" /> Audit reports
              </span>
              <h3 className="mt-3 text-[15px] font-bold text-white leading-snug">
                One-click PDF export
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Download polished routing and cost audit reports for any fleet, any time range.
              </p>
            </div>
          </div>

        </div>
      </div>

    </section>
  );
}