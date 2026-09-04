import Link from "next/link";
import type { SavingsSummary } from "@/server/account";

function usd(value: number) {
  return Math.abs(value) >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PortalApp({ user, savings }: { user: { email: string; name: string }; savings: SavingsSummary }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Savings</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary sm:text-5xl">
        What you did not spend.
      </h1>
      <p className="mt-3 max-w-xl text-secondary">
        Versus always sending traffic to the frontier model on {user.name || user.email}. Routing and cache are
        counted separately.
      </p>

      <div className="mt-12 rounded-2xl border border-primary/[0.06] bg-card p-8">
        <p className="text-sm text-secondary">Saved so far</p>
        <p className="mt-2 font-display text-5xl font-medium tracking-tight text-accent">{usd(savings.saved_usd)}</p>
        <p className="mt-2 text-sm text-secondary">
          {savings.saved_pct ? `${savings.saved_pct.toFixed(1)}% under baseline` : "No routed traffic yet"}
          {savings.requests ? ` · ${savings.requests} request${savings.requests === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Routed spend" value={usd(savings.actual_usd)} />
        <Stat label="Frontier baseline" value={usd(savings.baseline_usd)} />
        <Stat label="From routing" value={usd(savings.routing_saved_usd)} />
        <Stat label="From cache" value={usd(savings.cache_saved_usd)} />
        <Stat label="Cache hits" value={String(savings.cache_hits)} />
        <Stat label="Escalations" value={String(savings.escalations)} />
      </div>

      {savings.recent.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-primary/[0.06] px-6 py-12 text-center">
          <p className="text-sm text-secondary">
            Send traffic from the <Link href="/console" className="text-primary">console</Link> or the CLI. Receipts
            land here.
          </p>
        </div>
      ) : (
        <ul className="mt-12 divide-y divide-primary/5 rounded-2xl border border-primary/[0.06]">
          {savings.recent.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-mono text-[13px] text-primary">{row.model}</p>
                <p className="text-sm text-secondary">
                  {when(row.created_at)} · {row.tier}
                  {row.cache_hit ? " · cache" : row.escalated ? " · escalated" : ""}
                </p>
              </div>
              <p className="text-sm text-accent">{usd(row.saved_usd)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary/[0.06] bg-card px-5 py-4">
      <p className="text-sm text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-primary">{value}</p>
    </div>
  );
}
