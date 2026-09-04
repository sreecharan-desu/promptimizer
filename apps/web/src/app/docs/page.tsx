import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Docs" };

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <p className="text-xs font-medium tracking-wide text-accent">DOCS</p>
      <h1 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-primary sm:text-5xl">
        How Promptimizer decides.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-secondary">
        Production audits keep repeating the same unused lever: send easy work to a cheap model, reserve frontier
        models for hard work, and cache the system prompt you already paid for. Promptimizer makes that lever
        measurable.
      </p>

      <h2 className="mt-16 font-display text-3xl tracking-tight text-primary">The path of a request</h2>
      <ol className="mt-6 space-y-6">
        {[
          ["01", "Classify", "A transparent heuristic scores complexity 1–5 and a category. High-risk categories (system design, legal/medical, deep reasoning) cannot land on economy."],
          ["02", "Route", "Pick the cheapest selected model in the adequate tier. If that tier is empty, step up — never step down."],
          ["03", "Cache", "Hash system messages and long context prefixes. Repeat prefixes bill at half input, like provider prompt caching."],
          ["04", "Guard", "If the cheap answer looks like a refusal or is too thin for the difficulty, escalate and retry on the next tier."],
          ["05", "Measure", "Cost is always compared to the configured frontier baseline on the same token counts. Quality is scored against gold on the fixed task set."],
        ].map(([n, title, body]) => (
          <li key={n} className="grid gap-2 sm:grid-cols-[64px_1fr]">
            <p className="font-display text-2xl text-primary/40">{n}</p>
            <div>
              <h3 className="font-display text-2xl font-medium tracking-tight text-primary">{title}</h3>
              <p className="mt-2 leading-relaxed text-secondary">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 id="quality" className="mt-16 font-display text-3xl tracking-tight text-primary">
        Quality is a first-class metric
      </h2>
      <p className="mt-4 leading-relaxed text-secondary">
        The dashboard does not stop at dollars. Each benchmark row gets a gold-answer score (lexical overlap +
        required concepts + structure). The summary prints routed quality, frontier quality, and the delta. A
        router that dumps everything on nano will show a fat savings number and a collapsed quality score — and
        that is a losing demo.
      </p>

      <h2 className="mt-16 font-display text-3xl tracking-tight text-primary">Why this stack</h2>
      <ul className="mt-4 space-y-3 text-secondary">
        <li>
          <span className="text-primary">FastAPI + Python</span> — suggested by the brief, excellent OpenAPI, easy
          to audit.
        </li>
        <li>
          <span className="text-primary">Next.js on Vercel</span> — marketing, console, and a serverless gateway so
          the live demo does not depend on a second host.
        </li>
        <li>
          <span className="text-primary">TypeScript SDK</span> — drop-in npm package, same classifier you can run
          offline.
        </li>
        <li>
          <span className="text-primary">Redis or memory cache</span> — Compose for production-shaped deploys,
          memory for the simulator.
        </li>
      </ul>

      <div className="mt-16 flex flex-wrap gap-3">
        <Link href="/docs/api" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background">
          API reference
        </Link>
        <Link href="/docs/sdk" className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]">
          npm SDK
        </Link>
      </div>
    </article>
  );
}
