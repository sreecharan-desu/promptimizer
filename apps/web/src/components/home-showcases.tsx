import Link from "next/link";

const CARDS = [
  {
    href: "/docs/guides/classification",
    name: "Classify",
    mock: (
      <div className="rounded-xl bg-codeblock p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-secondary">complexity</p>
        <p className="text-primary">L2 · factual_recall</p>
        <p className="mt-3 text-secondary">quality risk</p>
        <p className="text-primary">low</p>
      </div>
    ),
  },
  {
    href: "/docs/guides/routing",
    name: "Route",
    mock: (
      <div className="rounded-xl bg-codeblock p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-primary">promptimizer-nano</p>
        <p className="mt-1 text-secondary">economy</p>
        <p className="mt-3 text-primary">94% vs frontier</p>
      </div>
    ),
  },
  {
    href: "/docs/guides/caching",
    name: "Cache",
    mock: (
      <div className="rounded-xl bg-codeblock p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-secondary">prefix</p>
        <p className="text-primary">system + context</p>
        <p className="mt-3 text-secondary">hit</p>
        <p className="text-primary">50% input billed</p>
      </div>
    ),
  },
  {
    href: "/docs/guides/quality",
    name: "Quality",
    mock: (
      <div className="rounded-xl bg-codeblock p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-secondary">gate</p>
        <p className="text-primary">thin answer</p>
        <p className="mt-3 text-secondary">retry</p>
        <p className="text-primary">economy → standard</p>
      </div>
    ),
  },
  {
    href: "/portal",
    name: "Savings",
    mock: (
      <div className="rounded-xl bg-codeblock p-4 font-mono text-[13px] leading-relaxed">
        <p className="text-secondary">this request</p>
        <p className="font-display text-2xl font-medium tracking-tight text-accent">$0.0041</p>
        <p className="mt-3 text-secondary">vs always-frontier</p>
      </div>
    ),
  },
];

export function HomeShowcases() {
  return (
    <div className="mt-16 grid gap-4 md:grid-cols-6">
      {CARDS.map((card, index) => (
        <Link
          key={card.name}
          href={card.href}
          className={`group/card relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl border border-primary/[0.06] bg-card p-5 transition-colors duration-150 hover:border-primary/20 hover:shadow-primary/[0.03] ${
            index < 3 ? "md:col-span-2" : "md:col-span-3"
          }`}
        >
          {card.mock}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm font-medium text-primary">{card.name}</span>
            <span className="text-sm text-secondary group-hover/card:text-primary">Explore →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
