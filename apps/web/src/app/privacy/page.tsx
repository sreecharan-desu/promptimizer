import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 py-24 sm:px-6">
      <p className="text-sm text-secondary">Last updated 5 September 2026</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-primary">Privacy</h1>
      <div className="mt-8 space-y-4 text-base leading-6 text-secondary">
        <p>Promptimizer is a BYOK router. We do not want your keys longer than a session.</p>
        <h2 className="pt-4 text-xl font-medium text-primary">What we store</h2>
        <p>
          Provider API keys are encrypted with a server secret and held in memory (or Redis with a TTL) for the
          session only. They are never written to logs, the database, or the browser&apos;s localStorage. The
          browser stores only a session id.
        </p>
        <h2 className="pt-4 text-xl font-medium text-primary">Email</h2>
        <p>
          If you create an account with email and password, we send a verification link and, if you ask, a
          password-reset link. Those are transactional only (no marketing). Messages are sent through Google SMTP
          from the configured mailbox.
        </p>
        <h2 className="pt-4 text-xl font-medium text-primary">What we send</h2>
        <p>
          When you use BYOK, prompts go to the base URL you typed — OpenAI, Groq, or any other OpenAI-compatible
          host. We do not run a local answer simulator; completions always hit your connected providers.
        </p>
      </div>
    </article>
  );
}
