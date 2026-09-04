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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3">
        <UserAvatar name={user.name} email={user.email} src={user.avatarUrl} size={40} />
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-primary">{user.name || "Account"}</h1>
          <p className="text-sm text-secondary">{user.email}</p>
        </div>
      </div>

      <h2 className="mt-12 text-sm font-medium text-primary">API keys</h2>
      <p className="mt-1 text-sm text-secondary">
        Send as <span className="font-mono text-primary">Authorization: Bearer pmz_live_…</span>
      </p>

      <form onSubmit={createKey} className="mt-6 flex flex-wrap items-end gap-3">
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
          className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-background disabled:opacity-60"
        >
          Create key
        </button>
      </form>

      {created ? (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3">
          <p className="text-xs text-secondary">Copy now. This value is shown once.</p>
          <p className="mt-2 break-all font-mono text-sm text-primary">{created}</p>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

      <div className="mt-8 overflow-hidden rounded-xl border border-primary/[0.06]">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-secondary">
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

      <h2 className="mt-12 text-sm font-medium text-primary">Use a key</h2>
      <p className="mt-1 mb-6 text-sm text-secondary">SDK, CLI, or curl against the hosted API.</p>
      <CodePanel />
    </div>
  );
}
