import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[680px] px-4 py-24 sm:px-6">
      <p className="text-sm text-secondary">Last updated 5 September 2026</p>
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-primary">Privacy</h1>
      <div className="mt-8 space-y-4 text-base leading-6 text-secondary">
        <p>
          Promptimizer is a BYOK router. Completions go to the providers you connect. We store the minimum needed to
          run routing, savings, and your account.
        </p>
        <h2 className="pt-4 text-xl font-medium text-primary">What we store</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-primary">Provider API keys</strong> — encrypted at rest with a server secret
            (AES-GCM) in our database when you are signed in, so your fleet survives across devices. Keys are never
            written to browser localStorage or application logs.
          </li>
          <li>
            <strong className="text-primary">Prompts &amp; routing metadata</strong> — recent prompts (truncated) and
            cost/quality receipts may be stored for the savings portal. Delete your account to remove provider keys and
            sessions; contact us for a full usage-history purge.
          </li>
          <li>
            <strong className="text-primary">Semantic cache</strong> — similar prompts may store an answer vector
            (Redis and/or Qdrant) scoped to your account, with TTL / invalidation on logout, disconnect, and model
            refresh.
          </li>
          <li>
            <strong className="text-primary">Account</strong> — email, hashed password (or Google subject), session
            cookies.
          </li>
        </ul>
        <h2 className="pt-4 text-xl font-medium text-primary">Email</h2>
        <p>
          If you create an account with email and password, we send a verification link and, if you ask, a
          password-reset link. Those are transactional only (no marketing).
        </p>
        <h2 className="pt-4 text-xl font-medium text-primary">What we send</h2>
        <p>
          When you use BYOK, prompts go to the base URL you configured — OpenAI, Groq, Baseten, or any other
          OpenAI-compatible host. We do not run a local answer simulator; completions always hit your connected
          providers.
        </p>
        <h2 className="pt-4 text-xl font-medium text-primary">Deletion</h2>
        <p>
          Deleting your account removes provider rows, sessions, and API keys from our database. Cached completions for
          your account are invalidated. Contact us if you need a full purge of usage history.
        </p>
      </div>
    </article>
  );
}
