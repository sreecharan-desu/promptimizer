import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { DOCS_HOME } from "@/lib/site";

export function UnizHero() {
  return (
    <section className="hero-suite relative overflow-hidden">
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="hero-rule hero-rule-left pointer-events-none absolute inset-y-0" aria-hidden="true" />
      <div className="hero-rule hero-rule-right pointer-events-none absolute inset-y-0" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[37rem] max-w-6xl flex-col items-center justify-center px-4 pb-24 pt-32 text-center sm:min-h-[42rem] sm:px-6 sm:pb-28 sm:pt-40">
        <p className="hero-kicker"><span /> Promptimizer / production routing</p>
        <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.6rem,9vw,8.3rem)] font-semibold leading-[0.86] tracking-[-0.085em] text-balance">
          <span className="block text-[#F5F3ED]">Model routing,</span>
          <span className="hero-title-muted block">made deliberate.</span>
        </h1>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="hero-action-primary inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all duration-200"
          >
            Build your routing policy
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="hero-action-secondary inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold transition-colors"
          >
            Read the docs
          </a>
        </div>

        <div className="hero-proof mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px] font-medium">
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> OpenAI-compatible</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Bring your own keys</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> No routing markup</span>
        </div>
      </div>
    </section>
  );
}
