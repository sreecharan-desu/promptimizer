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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-medium tracking-tight text-primary">Savings</h1>
      <p className="mt-2 text-secondary">
        Routed spend versus always using the frontier model
        {user.name || user.email ? ` for ${user.name || user.email}` : ""}.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Saved" value={usd(savings.saved_usd)} accent />
        <Stat label="Routed" value={usd(savings.actual_usd)} />
        <Stat label="Baseline" value={usd(savings.baseline_usd)} />
        <Stat label="From routing" value={usd(savings.routing_saved_usd)} />
        <Stat label="From cache" value={usd(savings.cache_saved_usd)} />
        <Stat label="Requests" value={String(savings.requests)} />
      </div>

      {savings.recent.length === 0 ? (
        <p className="mt-12 text-sm text-secondary">
          No traffic yet. Send a request from the <Link href="/console" className="text-primary">console</Link> or CLI.
        </p>
      ) : (
        <ul className="mt-12 overflow-hidden rounded-xl border border-primary/[0.06]">
          {savings.recent.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-primary/5 px-4 py-3 first:border-t-0">
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-primary/[0.06] bg-card px-5 py-4">
      <p className="text-sm text-secondary">{label}</p>
      <p className={`mt-1 font-display text-2xl font-medium ${accent ? "text-accent" : "text-primary"}`}>{value}</p>
    </div>
  );
}
