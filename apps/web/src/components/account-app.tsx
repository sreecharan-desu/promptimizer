"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppDock } from "./app-dock";
import { UserAvatar } from "./avatar";
import { CodePanel } from "./code-panel";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  monthly_budget_usd?: number | null;
  current_spend_usd?: number;
  environment?: string;
  is_active?: boolean;
  last_used_at: string | null;
  created_at: string;
};

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
  const [budget, setBudget] = useState<string>("50");
  const [environment, setEnvironment] = useState<string>("production");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const budgetNum = budget.trim() === "" || budget.trim() === "0" ? null : Number(budget);
      const response = await fetch("/api/account/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          monthly_budget_usd: isNaN(Number(budgetNum)) ? null : budgetNum,
          environment,
        }),
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

  async function toggleActive(key: KeyRow) {
    await fetch(`/api/account/keys/${key.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: !(key.is_active ?? true) }),
    });
    router.refresh();
  }

  async function resetSpend(id: string) {
    await fetch(`/api/account/keys/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reset_spend: true }),
    });
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? Applications using it will immediately be blocked.")) return;
    await fetch(`/api/account/keys/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="console-shell relative mx-auto min-h-[calc(100vh-5rem)] max-w-7xl">
      <AppDock activeTab="keys" />
      <div className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:py-8 lg:pl-[5.75rem] lg:pr-8 lg:pb-10">
        <div className="mx-auto max-w-4xl">
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">Access & Governance</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-primary">Virtual API keys</h2>
            </div>
            <p className="text-sm text-secondary">
              Pass as <span className="font-mono text-primary">Authorization: Bearer pmz_live_…</span>
            </p>
          </div>

          <form onSubmit={createKey} className="metric-surface mt-5 rounded-2xl p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-secondary">Key name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Agent, Staging QA"
                  className="auth-field mt-2 h-11 w-full rounded-xl border px-3 text-sm text-primary outline-none"
                />
              </label>

              <label className="sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-secondary">Environment</span>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="auth-field mt-2 h-11 w-full rounded-xl border px-3 text-sm text-primary outline-none"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </label>

              <label className="sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-secondary">Monthly spend cap ($)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 50 (0 or empty = unlimited)"
                  className="auth-field mt-2 h-11 w-full rounded-xl border px-3 text-sm text-primary outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-primary/5">
              <div className="flex items-center gap-1.5 text-xs text-secondary">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => setBudget("25")}
                  className={`rounded-md px-2 py-1 transition-colors ${budget === "25" ? "bg-accent/20 text-accent font-semibold" : "hover:bg-primary/[0.05]"}`}
                >
                  $25/mo
                </button>
                <button
                  type="button"
                  onClick={() => setBudget("100")}
                  className={`rounded-md px-2 py-1 transition-colors ${budget === "100" ? "bg-accent/20 text-accent font-semibold" : "hover:bg-primary/[0.05]"}`}
                >
                  $100/mo
                </button>
                <button
                  type="button"
                  onClick={() => setBudget("500")}
                  className={`rounded-md px-2 py-1 transition-colors ${budget === "500" ? "bg-accent/20 text-accent font-semibold" : "hover:bg-primary/[0.05]"}`}
                >
                  $500/mo
                </button>
                <button
                  type="button"
                  onClick={() => setBudget("")}
                  className={`rounded-md px-2 py-1 transition-colors ${budget === "" ? "bg-accent/20 text-accent font-semibold" : "hover:bg-primary/[0.05]"}`}
                >
                  Unlimited
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_hsl(var(--accent)/0.9)] transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                Create virtual key
              </button>
            </div>
          </form>

          {created ? (
            <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
              <p className="text-xs text-secondary font-medium">Copy now. This key will not be shown again.</p>
              <p className="mt-2 break-all font-mono text-sm text-primary select-all">{created}</p>
            </div>
          ) : null}
          {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}

          <div className="metric-surface mt-8 overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-primary/[0.035] text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Key & Scope</th>
                  <th className="px-4 py-3 font-medium">Prefix</th>
                  <th className="px-4 py-3 font-medium">Monthly Spend / Cap</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last used</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-secondary text-center">
                      No keys yet. Create a scoped key with spend limits above.
                    </td>
                  </tr>
                ) : (
                  keys.map((key) => {
                    const spend = Number(key.current_spend_usd || 0);
                    const cap = key.monthly_budget_usd != null ? Number(key.monthly_budget_usd) : null;
                    const pct = cap ? Math.min(100, Math.round((spend / cap) * 100)) : 0;
                    const isExceeded = cap !== null && spend >= cap;
                    const isActive = key.is_active ?? true;

                    return (
                      <tr key={key.id} className="border-t border-primary/5 hover:bg-primary/[0.02] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{key.name}</span>
                            <span className="rounded bg-primary/[0.06] px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold text-secondary">
                              {key.environment || "production"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-secondary">{key.prefix}…</td>
                        <td className="px-4 py-3.5">
                          <div className="w-40">
                            <div className="flex justify-between text-xs font-mono">
                              <span className={isExceeded ? "text-error font-semibold" : "text-primary"}>
                                ${spend.toFixed(2)}
                              </span>
                              <span className="text-secondary">
                                {cap ? `$${cap.toFixed(2)}` : "No limit"}
                              </span>
                            </div>
                            {cap ? (
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/[0.08]">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isExceeded
                                      ? "bg-error"
                                      : pct > 80
                                        ? "bg-amber-400"
                                        : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              !isActive
                                ? "bg-secondary/10 text-secondary"
                                : isExceeded
                                  ? "bg-error/10 text-error"
                                  : "bg-emerald-500/10 text-emerald-500"
                            }`}
                          >
                            <span className={`size-1.5 rounded-full ${!isActive ? "bg-secondary" : isExceeded ? "bg-error" : "bg-emerald-500"}`} />
                            {!isActive ? "Paused" : isExceeded ? "Capped" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-secondary text-xs">{when(key.last_used_at)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleActive(key)}
                              className="text-xs text-secondary hover:text-primary transition-colors"
                            >
                              {isActive ? "Pause" : "Resume"}
                            </button>
                            {spend > 0 ? (
                              <button
                                type="button"
                                onClick={() => resetSpend(key.id)}
                                title="Reset spend counter"
                                className="text-xs text-secondary hover:text-primary transition-colors"
                              >
                                Reset
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => revoke(key.id)}
                              className="text-xs text-error/80 hover:text-error transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.13em] text-accent">Integration</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.035em] text-primary">Use a key</h2>
          <p className="mt-1 mb-6 text-sm text-secondary">SDK, CLI, or curl against the hosted API.</p>
          <CodePanel />
        </div>
      </div>
    </div>
  );
}
