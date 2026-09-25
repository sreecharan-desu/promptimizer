import { CodePanel } from "@/components/code-panel";
import { HomeBottomCta } from "@/components/home-bottom-cta";
import { HomeFeatures } from "@/components/home-features";
import { ProviderIcon } from "@/components/provider-icon";
import { UnizHero } from "@/components/uniz-hero";

const PROVIDERS = [
  { name: "OpenAI", id: "openai" },
  { name: "Anthropic", id: "anthropic" },
  { name: "Google Gemini", id: "google" },
  { name: "Groq", id: "groq" },
  { name: "Mistral AI", id: "mistral" },
  { name: "OpenRouter", id: "openrouter" },
  { name: "DeepSeek", id: "deepseek" },
];

export default function HomePage() {
  return (
    <>
      <UnizHero />

      <div className="relative mx-auto max-w-6xl px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-2">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-7" role="list" aria-label="Supported AI providers">
          {PROVIDERS.map((provider) => (
            <div
              key={provider.name}
              className="inline-flex items-center gap-2 text-xs font-medium text-secondary transition-colors duration-150 hover:text-primary"
              role="listitem"
              title={provider.name}
            >
              <ProviderIcon id={provider.id} className="size-3.5 opacity-80" />
              <span>{provider.name}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">One policy layer</p>
          <h2 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.12] tracking-[-0.04em] text-primary text-balance sm:text-5xl sm:leading-[1.08]">
            Smarter routing without a new workflow.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-secondary sm:text-lg sm:leading-8">
            Your application keeps making requests. Promptimizer takes care of the decisions that turn a model fleet
            into a reliable product surface.
          </p>
        </div>
        <div className="mt-9"><HomeFeatures /></div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-14">
        <div>
          <p className="eyebrow">Built for developers</p>
          <h2 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.12] tracking-[-0.04em] text-primary text-balance sm:text-5xl sm:leading-[1.08]">
            One endpoint. Every routing decision.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-secondary sm:text-lg sm:leading-8">
            Keep your current SDK, CLI, or curl workflow. Track routed spend and quality in the console as traffic flows.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-border/80 pt-6">
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

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-primary px-6 py-10 text-background shadow-[var(--shadow-soft-lg)] sm:px-10 sm:py-12">
          <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-background/55">Ready when you are</p>
              <h2 className="mt-2.5 font-display text-[1.85rem] font-semibold tracking-[-0.035em] sm:text-[2.15rem]">
                Make every token count.
              </h2>
              <p className="mt-2.5 text-[15px] leading-7 text-background/65 sm:text-base">
                Connect a provider, create a key, and send your first intelligently-routed request in minutes.
              </p>
            </div>
            <HomeBottomCta />
          </div>
        </div>
      </section>
    </>
  );
}
