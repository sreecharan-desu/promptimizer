import Link from "next/link";
import { CodePanel } from "@/components/code-panel";
import { HomeFeatures } from "@/components/home-features";
import { HeroSpot, StartSpot } from "@/components/home-spots";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <p className="font-display text-sm font-medium tracking-wide text-secondary">Promptimizer</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-primary text-balance sm:text-5xl lg:text-6xl">
          Route prompts to the cheapest model that still answers well.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary text-pretty">
          One OpenAI-compatible API. Classify, route, cache, and measure cost versus always using the frontier
          model.
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

        <div className="mt-16">
          <HeroSpot />
        </div>

        <HomeFeatures />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">One API.</h2>
        <p className="font-display text-4xl font-medium tracking-tight text-secondary sm:text-5xl">OpenAI-compatible.</p>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary text-pretty">
          Drop-in chat completions from the SDK, CLI, or curl.
        </p>
        <div className="mt-10">
          <CodePanel />
        </div>
        <dl className="mt-12 grid gap-8 sm:grid-cols-3">
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
        <div className="overflow-hidden rounded-2xl border border-primary/[0.06] bg-card">
          <div className="grid items-center gap-0 lg:grid-cols-2">
            <div className="p-8">
              <h2 className="font-display text-3xl font-medium tracking-tight text-primary sm:text-4xl">
                Start with a key.
              </h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-secondary">
                Create an account, mint a <span className="font-mono text-primary">pmz_live_</span> key, and route from
                the console, SDK, or CLI.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
                >
                  Get started
                </Link>
                <Link
                  href="/docs/sdk"
                  className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
                >
                  npm i promptimizer
                </Link>
              </div>
            </div>
            <div className="border-t border-primary/[0.06] bg-codeblock p-5 lg:border-l lg:border-t-0">
              <StartSpot />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
