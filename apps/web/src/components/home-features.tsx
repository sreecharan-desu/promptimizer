import { DOCS_URL } from "@/lib/site";
import { ScanSearch, GitFork, BarChart3, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    href: `${DOCS_URL}/docs/guides/classification`,
    step: "01",
    name: "Classify intent",
    title: "Understand the work before the model runs.",
    dek: "Score complexity and quality risk at the edge, so light asks do not quietly inherit frontier spend.",
    icon: <ScanSearch className="size-5 text-emerald-600 dark:text-emerald-400" />,
    stat: "Request-aware",
  },
  {
    href: `${DOCS_URL}/docs/guides/routing`,
    step: "02",
    name: "Route with context",
    title: "Select the right capability for each ask.",
    dek: "Direct requests to economy, standard, or frontier models, then step up only when the quality gate asks for it.",
    icon: <GitFork className="size-5 text-emerald-600 dark:text-emerald-400" />,
    stat: "Quality-gated",
  },
  {
    href: `${DOCS_URL}/docs/guides/caching`,
    step: "03",
    name: "Measure outcomes",
    title: "Make quality, cost, and reuse visible.",
    dek: "Track savings against an always-frontier baseline and recognize repeated context before it becomes waste.",
    icon: <BarChart3 className="size-5 text-emerald-600 dark:text-emerald-400" />,
    stat: "Always auditable",
  },
] as const;

export function HomeFeatures() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <a
          key={feature.name}
          href={feature.href}
          target="_blank"
          rel="noopener noreferrer"
          className="feature-card group min-h-[18.5rem] rounded-[1.5rem] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80"
        >
          <div className="relative z-10 flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
              {feature.icon}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{feature.step}</span>
          </div>
          <div className="relative z-10 mt-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">{feature.name}</p>
            <h3 className="mt-2.5 font-display text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{feature.dek}</p>
          </div>
          <div className="relative z-10 mt-6 flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800/80 pt-4 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>{feature.stat}</span>
            <ArrowRight className="size-4 text-emerald-500 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </a>
      ))}
    </div>
  );
}
