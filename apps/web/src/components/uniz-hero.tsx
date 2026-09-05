import Link from "next/link";
import { Activity, ArrowRight, Check, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { DOCS_URL } from "@/lib/site";

const routingRows = [
  { task: "Product question", model: "GPT-4o mini", cost: "$0.002", tone: "emerald" },
  { task: "Contract review", model: "Claude Sonnet", cost: "$0.018", tone: "indigo" },
  { task: "Repeat request", model: "Semantic cache", cost: "$0.000", tone: "amber" },
];

export function UnizHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-primary/[0.08] bg-background">
      <div aria-hidden="true" className="hero-grid absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-[34rem] w-[44rem] -translate-x-1/2 rounded-full bg-accent/[0.10] blur-3xl" />

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-accent/60" /><span className="relative size-2 rounded-full bg-accent" /></span>
            OpenAI-compatible routing
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-[-0.055em] text-primary text-balance sm:text-6xl lg:text-[4.25rem] lg:leading-[1.02]">
            Your best model decision, every request.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-secondary sm:text-xl">
            Promptimizer routes each request across your model fleet for the right balance of quality, speed, and cost — behind one familiar API.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-background shadow-[0_16px_34px_-18px_hsl(var(--primary)/0.75)] transition-transform hover:-translate-y-0.5">
              Start routing for free <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href={`${DOCS_URL}/docs/sdk`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary/15 bg-background/80 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.04]">Read the docs</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-secondary">
            {["Bring your own providers", "No SDK migration", "Usage visible in real time"].map((item) => (
              <li key={item} className="flex items-center gap-2"><span className="flex size-4 items-center justify-center rounded-full bg-accent/[0.12] text-accent"><Check className="size-3" /></span>{item}</li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[2rem] bg-accent/[0.10] blur-2xl" />
          <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card shadow-[0_30px_70px_-38px_hsl(var(--primary)/0.55)]">
            <div className="flex items-center justify-between border-b border-primary/[0.08] px-5 py-4">
              <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-accent/[0.12] text-accent"><Activity className="size-4" /></span><div><p className="text-sm font-semibold text-primary">Live routing</p><p className="text-[11px] text-secondary">Last three requests</p></div></div>
              <span className="rounded-full bg-accent/[0.12] px-2.5 py-1 text-[10px] font-semibold text-accent">All systems normal</span>
            </div>
            <div className="p-3 sm:p-4">
              {routingRows.map((row) => (
                <div key={row.task} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-primary/[0.035] sm:grid-cols-[1fr_1.15fr_auto] sm:items-center">
                  <span className="truncate text-sm font-medium text-primary">{row.task}</span><span className="hidden text-xs text-secondary sm:block">{row.model}</span>
                  <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${row.tone === "emerald" ? "bg-accent/[0.12] text-accent" : row.tone === "indigo" ? "bg-primary/[0.08] text-primary" : "bg-warning/[0.12] text-warning"}`}>{row.cost}</span><span className="col-span-2 text-[11px] text-secondary sm:hidden">{row.model}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 border-t border-primary/[0.08] bg-primary/[0.025]">
              <div className="flex items-center gap-3 border-r border-primary/[0.08] px-4 py-4"><Zap className="size-4 text-accent" /><div><p className="text-lg font-semibold tracking-tight text-primary">42%</p><p className="text-[10px] font-medium uppercase tracking-wide text-secondary">Cost saved</p></div></div>
              <div className="flex items-center gap-3 px-4 py-4"><ShieldCheck className="size-4 text-accent" /><div><p className="text-lg font-semibold tracking-tight text-primary">99.9%</p><p className="text-[10px] font-medium uppercase tracking-wide text-secondary">Requests protected</p></div></div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-primary/10 bg-card px-3 py-2 shadow-lg sm:flex"><Sparkles className="size-3.5 text-accent" /><span className="text-xs font-medium text-primary">Quality gate passed</span></div>
        </div>
      </div>
    </section>
  );
}
