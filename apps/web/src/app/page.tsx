import Link from "next/link";
import { CodePanel } from "@/components/code-panel";
import { HomeShowcases } from "@/components/home-showcases";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Link
          href="/docs/sdk"
          className="inline-flex items-center gap-2.5 rounded-full border border-primary/[0.08] bg-card/60 py-1.5 pe-1.5 ps-2.5 backdrop-blur"
        >
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
            SDK
          </span>
          <span className="text-sm font-medium text-primary">npm i promptimizer</span>
          <span className="flex size-6 items-center justify-center rounded-full text-xs text-secondary">↗</span>
        </Link>

        <h1 className="mt-8 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-primary text-balance sm:text-5xl lg:text-6xl">
          Route prompts to the cheapest model that still answers well.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary text-pretty">
          Promptimizer sits in front of any OpenAI-compatible API. It classifies each request, caches repeated
          prefixes, and records cost versus always using the frontier model.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
          >
            Get started
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
          >
            Documentation
          </Link>
        </div>

        <HomeShowcases />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="font-display text-4xl tracking-tight text-primary sm:text-5xl">One API.</h2>
        <p className="font-display text-4xl tracking-tight text-secondary sm:text-5xl">OpenAI-compatible.</p>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary text-pretty">
          Drop-in chat completions. Classify, route, cache, and measure from the same client.
        </p>
        <div className="mt-10">
          <CodePanel />
        </div>
        <dl className="mt-10 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="font-display text-4xl font-medium tracking-tight text-primary">15</dt>
            <dd className="mt-2 text-sm text-secondary">gold tasks in the quality set</dd>
          </div>
          <div>
            <dt className="font-display text-4xl font-medium tracking-tight text-primary">50%</dt>
            <dd className="mt-2 text-sm text-secondary">input on a cached prefix</dd>
          </div>
          <div>
            <dt className="font-display text-4xl font-medium tracking-tight text-primary">3</dt>
            <dd className="mt-2 text-sm text-secondary">tiers — economy, standard, frontier</dd>
          </div>
        </dl>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="font-display text-2xl tracking-tight text-primary sm:text-3xl">Choose how to get started</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-primary/[0.06] bg-card p-6">
            <h3 className="font-display text-2xl font-medium tracking-tight text-primary">Build on your own</h3>
            <p className="mt-3 max-w-xl text-secondary">
              Create an account, mint a <span className="font-mono text-primary">pmz_live_</span> key, and route from
              the SDK or CLI.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
            >
              Get started
            </Link>
          </div>
          <div className="rounded-2xl border border-primary/[0.06] bg-card p-6">
            <h3 className="font-display text-2xl font-medium tracking-tight text-primary">Read the docs</h3>
            <p className="mt-3 max-w-xl text-secondary">
              Classification, routing, cache, quality gate, and the OpenAI-compatible API.
            </p>
            <Link
              href="/docs"
              className="mt-8 inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
            >
              Documentation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
