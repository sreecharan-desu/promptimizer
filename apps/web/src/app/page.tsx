import Link from "next/link";
import { CodePanel } from "@/components/code-panel";

const VERBS = ["route", "cache", "measure", "save"];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="flex justify-center">
          <Link
            href="/signup"
            className="group/trigger inline-flex items-center gap-2.5 rounded-full border border-primary/[0.08] bg-card/60 py-1.5 pe-1.5 ps-2.5 backdrop-blur"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium tracking-wide text-background">
              NEW
            </span>
            <span className="text-sm font-medium text-primary">Accounts and API keys are live</span>
            <span className="grid size-6 place-items-center rounded-full bg-primary/[0.06] text-xs">↗</span>
          </Link>
        </div>

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-primary text-balance sm:text-5xl lg:text-6xl">
            Route every prompt to the cheapest model that still gets it right.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-secondary">
            Promptimizer sits in front of any OpenAI-compatible API. It classifies difficulty, caches repeated
            context, and refuses to buy savings by silently degrading hard answers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
            >
              Create an account
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
            >
              How routing works
            </Link>
          </div>
          <p className="mt-5 text-sm text-secondary">
            {VERBS.map((verb, i) => (
              <span key={verb}>
                {i > 0 ? <span className="text-primary/20"> · </span> : null}
                <span className="text-primary/70">{verb}</span>
              </span>
            ))}
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-6">
          <Showcase className="md:col-span-3" title="Classifier" cta="See levels">
            <MockClassifier />
          </Showcase>
          <Showcase className="md:col-span-3" title="Router" cta="Open console">
            <MockRouter />
          </Showcase>
          <Showcase className="md:col-span-2" title="Prompt cache" cta="Read docs">
            <div className="font-mono text-[13px] text-primary/70">
              <p>prefix sha256 · hit</p>
              <p className="mt-2 text-accent">−50% input on repeated system</p>
            </div>
          </Showcase>
          <Showcase className="md:col-span-2" title="Quality gate" cta="Benchmark">
            <div>
              <p className="font-display text-3xl font-medium text-primary">pass</p>
              <p className="mt-2 text-sm text-secondary">Escalate if the cheap answer looks thin.</p>
            </div>
          </Showcase>
          <Showcase className="md:col-span-2" title="BYOK" cta="Connect">
            <div className="text-sm text-secondary">
              OpenAI, Groq, Baseten, OpenRouter — or any OpenAI-compatible /v1.
            </div>
          </Showcase>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="font-display text-3xl tracking-tight text-primary sm:text-4xl lg:text-5xl">
          One drop-in API.
          <br />
          Every OpenAI-compatible key.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-secondary">
          Point the official OpenAI client at Promptimizer, or use the npm package. Same chat completions shape —
          plus cost, route, and quality metadata.
        </p>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <CodePanel />
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-1">
            <Stat value="80%+" label="cost cut vs always-frontier on the fixed task set" />
            <Stat value="P(q|small)" label="route on expected quality, not an easy/hard if" />
            <Stat value="0 keys stored" label="BYOK sessions encrypt in memory and expire" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="font-display text-3xl tracking-tight text-primary sm:text-4xl">Quality-constrained, not cost-first.</h2>
        <p className="mt-4 max-w-2xl text-lg text-secondary">
          A cheap answer is not a win if it is wrong. The router predicts P(quality | small), escalates when the
          guard fails, and the benchmark compares four policies on the same gold set — always-frontier, difficulty-only,
          quality-aware, and quality-aware plus cache.
        </p>
        <div className="mt-10 overflow-hidden rounded-2xl border border-primary/[0.06] bg-card">
          <div className="grid grid-cols-4 border-b border-primary/[0.06] px-5 py-3 text-xs font-medium text-secondary">
            <span>Task</span>
            <span>Routed model</span>
            <span>Cost vs frontier</span>
            <span>Quality delta</span>
          </div>
          {[
            ["e01 Capital of France", "nano", "−98%", "+0.00"],
            ["m01 Merge sorted lists", "flash", "−86%", "−0.02"],
            ["h01 1M QPS limiter", "frontier", "0%", "+0.00"],
            ["h02 Infinitely many primes", "frontier", "0%", "+0.00"],
          ].map((row) => (
            <div key={row[0]} className="grid grid-cols-4 border-b border-primary/5 px-5 py-4 text-sm last:border-0">
              <span className="text-primary">{row[0]}</span>
              <span className="font-mono text-primary/80">{row[1]}</span>
              <span className="text-accent">{row[2]}</span>
              <span className="text-secondary">{row[3]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-primary/[0.06] bg-card p-8">
            <h3 className="font-display text-2xl font-medium tracking-tight text-primary">Build on your own</h3>
            <p className="mt-3 text-secondary">Simulator, npm package, Docker Compose. No vendor lock-in.</p>
            <Link href="/console" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background">
              Start in the console
            </Link>
          </div>
          <div className="rounded-2xl border border-primary/[0.06] bg-card p-8">
            <h3 className="font-display text-2xl font-medium tracking-tight text-primary">Read the contract</h3>
            <p className="mt-3 text-secondary">Every endpoint, every quality rule, why this stack.</p>
            <Link href="/docs" className="mt-6 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]">
              Open docs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Showcase({
  title,
  cta,
  className,
  children,
}: {
  title: string;
  cta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`group/card relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-primary/[0.06] bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-primary/[0.03] ${className ?? ""}`}>
      <div className="flex-1">{children}</div>
      <div className="mt-6 flex items-end justify-between">
        <p className="text-sm text-primary">{title}</p>
        <p className="text-sm text-secondary transition-colors group-hover/card:text-primary">{cta} →</p>
      </div>
    </div>
  );
}

function MockClassifier() {
  return (
    <div className="space-y-2 font-mono text-[13px]">
      <div className="flex justify-between text-secondary">
        <span>What is 17 * 24?</span>
        <span className="text-accent">L1 · economy</span>
      </div>
      <div className="flex justify-between text-secondary">
        <span>Merge two sorted lists</span>
        <span>L3 · standard</span>
      </div>
      <div className="flex justify-between text-primary">
        <span>1M QPS rate limiter</span>
        <span>L5 · frontier</span>
      </div>
    </div>
  );
}

function MockRouter() {
  return (
    <div className="flex h-full items-end gap-2 pt-6">
      {[32, 48, 28, 70, 36, 22, 80].map((h, i) => (
        <div
          key={i}
          className={`w-full rounded-sm ${i === 6 ? "bg-accent" : "bg-primary/15"}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-4xl font-medium tracking-tight text-primary lg:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-secondary">{label}</p>
    </div>
  );
}
