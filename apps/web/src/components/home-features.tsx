import { DOCS_URL } from "@/lib/site";

const FEATURES = [
  {
    href: `${DOCS_URL}/docs/guides/classification`,
    step: "01",
    name: "Classify intent",
    title: "Understand the work before the model runs.",
    dek: "Score complexity and quality risk at the edge, so light asks do not quietly inherit frontier spend.",
    icon: <ScanIcon />,
    stat: "Request-aware",
  },
  {
    href: `${DOCS_URL}/docs/guides/routing`,
    step: "02",
    name: "Route with context",
    title: "Select the right capability for each ask.",
    dek: "Direct requests to economy, standard, or frontier models, then step up only when the quality gate asks for it.",
    icon: <RouteIcon />,
    stat: "Quality-gated",
  },
  {
    href: `${DOCS_URL}/docs/guides/caching`,
    step: "03",
    name: "Measure outcomes",
    title: "Make quality, cost, and reuse visible.",
    dek: "Track savings against an always-frontier baseline and recognize repeated context before it becomes waste.",
    icon: <ChartIcon />,
    stat: "Always auditable",
  },
] as const;

export function HomeFeatures() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <a
          key={feature.name}
          href={feature.href}
          target="_blank"
          rel="noopener noreferrer"
          className="feature-card group min-h-[18.5rem] rounded-[1.35rem] p-6 sm:p-7"
        >
          <div className="relative z-10 flex items-start justify-between gap-4">
            <span className="feature-icon">{feature.icon}</span>
            <span className="font-mono text-[11px] text-secondary/70">{feature.step}</span>
          </div>
          <div className="relative z-10 mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">{feature.name}</p>
            <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] text-primary">
              {feature.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-secondary">{feature.dek}</p>
          </div>
          <div className="relative z-10 mt-6 flex items-center justify-between border-t border-primary/[0.07] pt-4 text-xs font-semibold text-primary/65">
            <span>{feature.stat}</span>
            <span className="text-accent transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8 12h8M12 8v8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5" aria-hidden="true">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="18" cy="17" r="2" />
      <path d="M8 6h2a4 4 0 0 1 4 4v5M14 10h2M14 15h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5" aria-hidden="true">
      <path d="M4 19.5V5" strokeLinecap="round" />
      <path d="M4 19.5h16" strokeLinecap="round" />
      <path d="m7.5 15 3.4-4 2.7 2.1L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="7.5" r="1.25" />
    </svg>
  );
}
