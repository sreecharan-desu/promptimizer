"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserAvatar } from "./avatar";
import { CodePanel } from "./code-panel";

type KeyRow = { id: string; name: string; prefix: string; last_used_at: string | null; created_at: string };

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AccountApp({
  user,
  keys,
}: {
  user: { email: string; name: string; avatarUrl?: string | null };
  keys: KeyRow[];
}) {
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
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <section className="metric-surface relative overflow-hidden rounded-[1.35rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent/[0.08] blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <UserAvatar name={user.name} email={user.email} src={user.avatarUrl} size={44} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">Workspace account</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{user.name || "Account"}</h1>
            <p className="mt-1 text-sm text-secondary">{user.email}</p>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">Access</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-primary">API keys</h2>
        </div>
        <p className="text-sm text-secondary">
        Send as <span className="font-mono text-primary">Authorization: Bearer pmz_live_…</span>
        </p>
      </div>

      <form onSubmit={createKey} className="metric-surface mt-5 flex flex-wrap items-end gap-3 rounded-2xl p-4 sm:p-5">
        <label className="min-w-48 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-secondary">Key name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-field mt-2 h-11 w-full rounded-xl border px-3 text-sm text-primary outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_hsl(var(--accent)/0.9)] transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          Create key
        </button>
      </form>

      {created ? (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
          <p className="text-xs text-secondary">Copy now. This value is shown once.</p>
          <p className="mt-2 break-all font-mono text-sm text-primary">{created}</p>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

      <div className="metric-surface mt-8 overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary/[0.035] text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Last used</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-secondary">
                  No keys yet.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-t border-primary/5">
                  <td className="px-4 py-3 text-primary">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-secondary">{key.prefix}…</td>
                  <td className="px-4 py-3 text-secondary">{when(key.created_at)}</td>
                  <td className="px-4 py-3 text-secondary">{when(key.last_used_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => revoke(key.id)} className="text-sm text-secondary hover:text-primary">
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">Integration</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-primary">Use a key</h2>
      <p className="mt-1 mb-6 text-sm text-secondary">SDK, CLI, or curl against the hosted API.</p>
      <CodePanel />
    </div>
  );
}
