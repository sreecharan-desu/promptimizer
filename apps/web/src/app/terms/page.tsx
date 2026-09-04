import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 py-24 sm:px-6">
      <p className="text-sm text-secondary">Last updated 4 September 2026</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-primary">Terms</h1>
      <div className="mt-8 space-y-4 text-base leading-6 text-secondary">
        <p>
          Promptimizer is provided for evaluation and production use as-is. You are responsible for the provider
          keys you attach and for the content you send through those providers.
        </p>
        <p>
          Cost figures are estimates from a public price catalog plus token heuristics. They are not invoices.
        </p>
      </div>
    </article>
  );
}
