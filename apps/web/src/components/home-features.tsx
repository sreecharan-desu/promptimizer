import { DOCS_URL } from "@/lib/site";
import { ScanSearch, GitFork, BarChart3, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    href: `${DOCS_URL}/docs/guides/classification`,
    step: "01",
    name: "Classify intent",
    title: "Understand the work before the model runs.",
    dek: "Score complexity and quality risk at the edge, so light asks do not quietly inherit frontier spend.",
    icon: ScanSearch,
    stat: "Request-aware",
  },
  {
    href: `${DOCS_URL}/docs/guides/routing`,
    step: "02",
    name: "Route with context",
    title: "Select the right capability for each ask.",
    dek: "Direct requests to economy, standard, or frontier models, then step up only when the quality gate asks for it.",
    icon: GitFork,
    stat: "Quality-gated",
  },
  {
    href: `${DOCS_URL}/docs/guides/caching`,
    step: "03",
    name: "Measure outcomes",
    title: "Make quality, cost, and reuse visible.",
    dek: "Track savings against an always-frontier baseline and recognize repeated context before it becomes waste.",
    icon: BarChart3,
    stat: "Always auditable",
  },
] as const;

export function HomeFeatures() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <a
            key={feature.name}
            href={feature.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[17.5rem] flex-col rounded-[1.35rem] border border-primary/[0.08] bg-card/55 p-6 shadow-[var(--shadow-soft-sm)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[var(--shadow-soft)] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-10 items-center justify-center rounded-[0.9rem] border border-border bg-background text-accent">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span className="font-mono text-[11px] font-semibold tabular-nums text-secondary/70">{feature.step}</span>
            </div>
            <div className="mt-7 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-secondary">{feature.name}</p>
              <h3 className="mt-2 font-display text-[1.35rem] font-semibold leading-[1.2] tracking-[-0.03em] text-primary text-balance sm:text-[1.45rem]">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-secondary">{feature.dek}</p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-border/80 pt-4 text-xs font-semibold text-primary/80">
              <span>{feature.stat}</span>
              <ArrowRight className="size-4 text-accent transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </a>
        );
      })}
    </div>
  );
}
