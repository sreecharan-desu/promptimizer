import Link from "next/link";
import { CodePanel } from "@/components/code-panel";
import { HomeFeatures } from "@/components/home-features";
import { ProductPreview } from "@/components/home-product-preview";
import { DOCS_HOME, DOCS_URL } from "@/lib/site";

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Groq", "Mistral", "OpenRouter"];

export default function HomePage() {
  return (
    <>
      <section className="landing-hero relative overflow-hidden">
        <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="landing-orb pointer-events-none absolute -right-36 -top-24 size-[34rem] rounded-full" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-28 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16 lg:pb-24 lg:pt-32">
          <div className="home-rise">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              Routing infrastructure
            </p>
            <h1 className="mt-5 max-w-2xl font-display text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.055em] text-primary text-balance sm:text-6xl lg:text-[4.25rem]">
              The routing layer for <span className="gradient-ink">model fleets.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[1.05rem] leading-8 text-secondary text-pretty sm:text-lg">
              A lightweight decision layer that keeps model spend predictable without trading away performance —
              behind one OpenAI-compatible API.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="hero-primary-action inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-background transition-all duration-200 hover:bg-primary-hover"
              >
                Set up your stack
                <span className="ml-2 text-base leading-none" aria-hidden="true">→</span>
              </Link>
              <a
                href={DOCS_HOME}
                target="_blank"
                rel="noopener noreferrer"
                className="hero-secondary-action inline-flex h-11 items-center rounded-xl border border-primary/10 bg-card/70 px-5 text-sm font-semibold text-primary shadow-sm transition-all duration-200 hover:bg-card"
              >
                Read the docs
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-secondary">
              <span className="inline-flex items-center gap-2"><Check /> Your keys and providers</span>
              <span className="inline-flex items-center gap-2"><Check /> Explicit routing policy</span>
              <span className="inline-flex items-center gap-2"><Check /> Measurable outcomes</span>
            </div>
          </div>

          <div className="home-rise home-rise-delay home-float-wrap">
            <ProductPreview />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl border-t border-primary/[0.08] px-4 py-5 sm:px-6">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary/75">Supports the providers you already use</p>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs font-semibold text-primary/50 sm:gap-x-10">
            {PROVIDERS.map((provider) => <span key={provider}>{provider}</span>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow">One policy layer</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em] text-primary text-balance sm:text-5xl">
            Smarter routing without a new workflow.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-secondary">
            Your application keeps making requests. Promptimizer takes care of the decisions that turn a model fleet
            into a reliable product surface.
          </p>
        </div>
        <div className="mt-10"><HomeFeatures /></div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.77fr_1.23fr] lg:items-center">
        <div>
          <p className="eyebrow">Built for developers</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.045em] text-primary text-balance sm:text-5xl">
            One endpoint. Every routing decision.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-8 text-secondary">
            Keep your current SDK, CLI, or curl workflow. Track routed spend and quality in the console as traffic flows.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-primary/[0.08] pt-6">
            <div>
              <dt className="font-display text-2xl font-semibold tracking-tight text-primary">15+</dt>
              <dd className="mt-1 text-xs leading-5 text-secondary">quality tasks in the built-in suite</dd>
            </div>
            <div>
              <dt className="font-display text-2xl font-semibold tracking-tight text-primary">50%</dt>
              <dd className="mt-1 text-xs leading-5 text-secondary">cache discount on repeated prefixes</dd>
            </div>
            <div>
              <dt className="font-display text-2xl font-semibold tracking-tight text-primary">3</dt>
              <dd className="mt-1 text-xs leading-5 text-secondary">routing tiers, one API contract</dd>
            </div>
          </dl>
        </div>
        <CodePanel />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-28">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-primary/[0.08] bg-primary px-6 py-10 text-background shadow-[0_28px_70px_-38px_hsl(var(--primary)/0.8)] sm:px-10 sm:py-14">
          <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-background/55">Ready when you are</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Make every token count.
              </h2>
              <p className="mt-3 text-base leading-7 text-background/65">
                Connect a provider, create a key, and send your first intelligently-routed request in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex h-11 items-center rounded-xl bg-background px-5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5">
                Create an account
              </Link>
              <a href={`${DOCS_URL}/docs/sdk`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-background transition-colors hover:bg-white/10">
                Explore the SDK
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Check() {
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-accent/[0.12] text-accent" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-2.5">
        <path d="m3.5 8 2.7 2.6 5.8-5.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
