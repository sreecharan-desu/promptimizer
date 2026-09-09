"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Sparkles, ShieldCheck, Zap, ArrowRight, DollarSign } from "lucide-react";

export function PricingApp() {
  const [monthlySpend, setMonthlySpend] = useState<number>(3000);

  // Conservative 65% reduction via caching + tier optimization
  const estimatedSavings = Math.round(monthlySpend * 0.65);
  const costWithPromptimizer = monthlySpend - estimatedSavings;
  const netMonthlyProfit = estimatedSavings - 149; // compared to Team tier
  const roiMultiplier = ((estimatedSavings / 149)).toFixed(1);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 size-96 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden="true" />

      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Commercial Infrastructure</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-primary sm:text-5xl">
          Self-funding AI gateway.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-secondary">
          Promptimizer pays for itself on day one. Route to the cheapest adequate tier, cache repetitive tokens, and never suffer upstream provider downtime.
        </p>
      </div>

      {/* Interactive ROI Calculator */}
      <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-primary/[0.08] bg-card p-6 sm:p-8 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="size-5 text-accent" />
            <h2 className="font-display text-lg font-semibold text-primary">Live ROI Calculator</h2>
          </div>
          <span className="rounded-full bg-accent/[0.1] px-3 py-1 font-mono text-xs font-bold text-accent">
            Positive ROI Guarantee
          </span>
        </div>

        <p className="mt-2 text-sm text-secondary">
          Slide your current monthly OpenAI & Anthropic spend to estimate your net savings:
        </p>

        <div className="mt-6">
          <div className="flex justify-between text-sm font-medium text-primary">
            <span>Monthly LLM Bill:</span>
            <span className="font-mono text-base text-accent font-bold">${monthlySpend.toLocaleString()}/mo</span>
          </div>
          <input
            type="range"
            min="300"
            max="30000"
            step="100"
            value={monthlySpend}
            onChange={(e) => setMonthlySpend(Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-primary/[0.1] accent-accent"
          />
          <div className="mt-1 flex justify-between text-[11px] text-secondary">
            <span>$300/mo</span>
            <span>$10,000/mo</span>
            <span>$30,000/mo</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl bg-primary/[0.03] p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-secondary">Estimated Savings</p>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-500 sm:text-2xl">
              ~${estimatedSavings.toLocaleString()}
            </p>
            <p className="text-[10px] text-secondary">65% cut in LLM bill</p>
          </div>
          <div>
            <p className="text-[11px] text-secondary">With Promptimizer</p>
            <p className="mt-1 font-mono text-xl font-bold text-primary sm:text-2xl">
              ${costWithPromptimizer.toLocaleString()}
            </p>
            <p className="text-[10px] text-secondary">Optimized token cost</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[11px] text-accent font-semibold">Net Profit Added</p>
            <p className="mt-1 font-mono text-xl font-bold text-accent sm:text-2xl">
              +${netMonthlyProfit.toLocaleString()}
            </p>
            <p className="text-[10px] text-accent font-medium">{roiMultiplier}x ROI on Team Plan</p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="mt-16 grid gap-8 lg:grid-cols-4">
        {/* Free / Developer */}
        <div className="flex flex-col justify-between rounded-3xl border border-primary/[0.08] bg-card p-6 transition-all hover:border-primary/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Developer</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-primary">Free</h3>
            <p className="mt-2 text-xs text-secondary">For solopreneurs, hackathons, and personal prototypes.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-primary">$0</span>
              <span className="text-xs text-secondary">/ month</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>BYOK (OpenAI, Groq, Ollama)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Standard 3-Tier Model Routing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>25,000 cached tokens / month</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Console playground & CLI</span>
              </li>
            </ul>
          </div>

          <Link
            href="/signup"
            className="mt-8 flex h-10 w-full items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.04] text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08]"
          >
            Start Free
          </Link>
        </div>

        {/* Pro */}
        <div className="flex flex-col justify-between rounded-3xl border border-primary/[0.08] bg-card p-6 transition-all hover:border-primary/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Pro</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-primary">Single App</h3>
            <p className="mt-2 text-xs text-secondary">For launched production apps and growing SaaS products.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-primary">$29</span>
              <span className="text-xs text-secondary">/ month</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span><strong>Multi-Provider Auto-Failover</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Unlimited routed requests</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Vector Semantic Cache (Qdrant)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Quality Gate & Automatic Escalation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Exportable CSV audit reports</span>
              </li>
            </ul>
          </div>

          <Link
            href="/console"
            className="mt-8 flex h-10 w-full items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.04] text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08]"
          >
            Launch Pro
          </Link>
        </div>

        {/* Team (Featured) */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-accent bg-card p-6 shadow-xl shadow-accent/[0.06]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Most Popular
          </span>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Team</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-primary">Scale & Governance</h3>
            <p className="mt-2 text-xs text-secondary">For engineering teams managing shared LLM spend and agents.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-primary">$149</span>
              <span className="text-xs text-secondary">/ month</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span><strong>Virtual Keys with Spend Caps</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span><strong>Cost Attribution by Dev & Env</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>99.99% Outage Circuit Breaker SLA</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Priority routing latency (&lt;12ms)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Up to 10 team seats</span>
              </li>
            </ul>
          </div>

          <Link
            href="/account"
            className="mt-8 flex h-10 w-full items-center justify-center rounded-xl bg-accent text-xs font-semibold text-white shadow-md transition-colors hover:bg-accent-hover"
          >
            Start Team Plan
          </Link>
        </div>

        {/* Enterprise */}
        <div className="flex flex-col justify-between rounded-3xl border border-primary/[0.08] bg-card p-6 transition-all hover:border-primary/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Enterprise</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-primary">Security & Compliance</h3>
            <p className="mt-2 text-xs text-secondary">For companies requiring strict data privacy, SOC2, & compliance.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-primary">$499+</span>
              <span className="text-xs text-secondary">/ month</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span><strong>Inline PII Masking & Scrubbing</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Canary A/B Model Traffic Splitting</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Isolated dedicated vector namespace</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent" />
                <span>Custom SLAs & Dedicated Slack Engineer</span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:sales@promptimizer.site?subject=Promptimizer%20Enterprise%20Inquiry"
            className="mt-8 flex h-10 w-full items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.04] text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08]"
          >
            Contact Sales
          </a>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-primary/[0.08] bg-primary/[0.02] p-6 text-center">
        <h3 className="font-display text-lg font-semibold text-primary">Why engineering teams trust Promptimizer</h3>
        <p className="mt-2 text-sm text-secondary">
          No proxy vendor lock-in. All vendor API keys are encrypted with AES-GCM-256. Zero training on your data. Drop-in replacement with standard <code className="font-mono text-accent">/api/v1</code> and OpenAI SDK compatibility.
        </p>
      </div>
    </div>
  );
}
