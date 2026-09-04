import Link from "next/link";
import { CodePanel } from "@/components/code-panel";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">
        Route prompts to the cheapest model that still answers well.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-secondary">
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

      <div className="mt-14">
        <CodePanel />
      </div>

      <dl className="mt-10 grid gap-6 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-secondary">Install</dt>
          <dd className="mt-1 font-mono text-sm text-primary">npm i promptimizer</dd>
        </div>
        <div>
          <dt className="text-sm text-secondary">CLI</dt>
          <dd className="mt-1 font-mono text-sm text-primary">npx promptimizer-cli</dd>
        </div>
        <div>
          <dt className="text-sm text-secondary">Auth</dt>
          <dd className="mt-1 font-mono text-sm text-primary">Bearer pmz_live_…</dd>
        </div>
      </dl>
    </section>
  );
}
