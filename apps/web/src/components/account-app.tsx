"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type KeyRow = { id: string; name: string; prefix: string; last_used_at: string | null; created_at: string };

export function AccountApp({ user, keys }: { user: { email: string; name: string }; keys: KeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("Production");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/account/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not create key");
      setCreated(data.key);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/account/keys/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Account</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary">API keys</h1>
      <p className="mt-3 text-secondary">
        Signed in as {user.name || user.email}. Use a key as{" "}
        <span className="font-mono text-primary">Authorization: Bearer pmz_live_…</span>
        {" · "}
        <Link href="/portal" className="text-primary">Savings</Link>
      </p>

      <form onSubmit={createKey} className="mt-10 flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">
          <span className="text-sm text-secondary">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-primary/10 bg-card px-3 text-sm text-primary outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background"
        >
          Create key
        </button>
      </form>

      {created ? (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Copy this now. It is shown once.</p>
          <p className="mt-2 break-all font-mono text-sm text-primary">{created}</p>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

      <ul className="mt-10 divide-y divide-primary/5 rounded-xl border border-primary/[0.06]">
        {keys.length === 0 ? (
          <li className="px-4 py-8 text-sm text-secondary">No keys yet. Create one to call the API from production.</li>
        ) : (
          keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-primary">{key.name}</p>
                <p className="font-mono text-xs text-secondary">{key.prefix}…</p>
              </div>
              <button type="button" onClick={() => revoke(key.id)} className="text-sm text-secondary hover:text-primary">
                Revoke
              </button>
            </li>
          ))
        )}
      </ul>

      <pre className="mt-10 overflow-x-auto rounded-xl border border-primary/[0.08] bg-card p-4 font-mono text-[13px] text-primary/80">{`import { Promptimizer } from "promptimizer";

const client = new Promptimizer({
  gatewayURL: "https://your-app.example/api",
  apiKey: process.env.PROMPTIMIZER_API_KEY,
});

await client.chat.completions.create({
  messages: [{ role: "user", content: "What is 17 * 24?" }],
});`}</pre>
    </div>
  );
}
