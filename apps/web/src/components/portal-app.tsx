import Link from "next/link";
import type { SavingsSummary } from "@/server/account";
import { Donut, Meter, MetricCard, MiniBars, Pill, Sparkline, pct, usd } from "./metrics";
import { RecentRequestRows } from "./portal-request-rows";

function chrono(events: SavingsSummary["recent"]) {
  return [...events].reverse();
}

export function PortalApp({ user, savings }: { user: { email: string; name: string }; savings: SavingsSummary }) {
  const series = chrono(savings.recent);
  const qualitySeries = series.map((e) => (e.quality == null ? 0 : e.quality * 100));
  const savedSeries = series.map((e) => e.saved_usd);
  const costSeries = series.map((e) => e.actual_usd);

  const tierCounts = { economy: 0, standard: 0, frontier: 0 };
  for (const e of savings.recent) {
    if (e.tier in tierCounts) tierCounts[e.tier as keyof typeof tierCounts] += 1;
  }
  const tierTotal = Object.values(tierCounts).reduce((a, b) => a + b, 0) || 1;

  const cacheMiss = Math.max(0, savings.requests - savings.cache_hits);
  const semanticHits = savings.semantic_hits ?? 0;
  const gateRate = savings.quality_gate_pass_rate;
  const audits = savings.quality_audits ?? 0;
  const auditPasses = savings.quality_audit_passes ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-primary">Savings</h1>
          <p className="mt-2 max-w-xl text-secondary">
            Estimated provider spend versus always-frontier
            {user.name || user.email ? ` · ${user.name || user.email}` : ""}. Exact, prefix, and similarity cache —
            plus a live quality gate. No routing fee — savings come from cheaper models and cache.
          </p>
        </div>
        <Pill tone={savings.requests ? "good" : "neutral"}>
          {savings.requests ? `${savings.requests} requests recorded` : "No traffic yet"}
        </Pill>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saved"
          value={usd(savings.saved_usd)}
          hint={`${pct(savings.saved_pct)} vs always-frontier`}
        >
          <Sparkline values={savedSeries.length > 1 ? savedSeries : [0, savings.saved_usd || 0]} />
        </MetricCard>

        <MetricCard label="API spend" value={usd(savings.actual_usd)} hint={`Frontier baseline ${usd(savings.baseline_usd)}`}>
          <MiniBars values={costSeries.length ? costSeries.slice(-16) : [0.01, 0.02, 0.015]} />
        </MetricCard>

        <MetricCard
          label="Quality"
          value={savings.avg_quality == null ? "—" : pct(savings.avg_quality * 100, 0)}
          hint={
            gateRate == null
              ? "Average gate score on routed answers"
              : `Gate pass ${pct(gateRate * 100, 0)} · audits ${auditPasses}/${audits || 0}`
          }
        >
          <Sparkline
            values={qualitySeries.length > 1 ? qualitySeries : [70, 73, 76]}
            stroke="hsl(var(--primary) / 0.55)"
            fill="hsl(var(--primary) / 0.08)"
          />
        </MetricCard>

        <MetricCard label="Fleet mix" value={String(savings.requests)} hint="Requests by tier">
          <div className="flex items-center gap-4">
            <Donut
              size={76}
              thickness={12}
              slices={[
                { label: "economy", value: tierCounts.economy, color: "hsl(var(--accent))" },
                { label: "standard", value: tierCounts.standard, color: "hsl(var(--primary) / 0.45)" },
                { label: "frontier", value: tierCounts.frontier, color: "hsl(var(--primary) / 0.2)" },
              ]}
              center={<span className="font-display text-sm font-medium text-primary">{tierTotal}</span>}
            />
            <ul className="space-y-1.5 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent" /> economy {tierCounts.economy}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary/45" /> standard {tierCounts.standard}
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary/20" /> frontier {tierCounts.frontier}
              </li>
            </ul>
          </div>
        </MetricCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-primary/[0.06] bg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Split</p>
              <p className="mt-1 font-display text-xl font-medium text-primary">Where the savings come from</p>
            </div>
          </div>
          <div className="mt-6 space-y-5">
            <SplitRow
              label="Cheaper model"
              value={usd(savings.routing_saved_usd)}
              share={savings.saved_usd ? (savings.routing_saved_usd / savings.saved_usd) * 100 : 0}
            />
            <SplitRow
              label="Cache discount"
              value={usd(savings.cache_saved_usd)}
              share={savings.saved_usd ? (savings.cache_saved_usd / savings.saved_usd) * 100 : 0}
            />
            <SplitRow
              label="Cache hit rate"
              value={`${savings.requests ? Math.round((savings.cache_hits / savings.requests) * 100) : 0}%`}
              share={savings.requests ? (savings.cache_hits / savings.requests) * 100 : 0}
            />
            <SplitRow
              label="Similarity reuse"
              value={`${savings.requests ? Math.round((semanticHits / savings.requests) * 100) : 0}%`}
              share={savings.requests ? (semanticHits / savings.requests) * 100 : 0}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/[0.06] bg-card p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Cache & gate</p>
          <p className="mt-1 font-display text-xl font-medium text-primary">Hits · similarity · audits</p>
          <div className="mt-5 flex items-center gap-4">
            <Donut
              size={96}
              thickness={14}
              slices={[
                { label: "hits", value: savings.cache_hits, color: "hsl(var(--accent))" },
                { label: "semantic", value: semanticHits, color: "hsl(var(--primary) / 0.45)" },
                { label: "misses", value: cacheMiss, color: "hsl(var(--primary) / 0.12)" },
              ]}
              center={
                <span className="font-display text-lg font-medium text-primary">
                  {savings.requests ? Math.round((savings.cache_hits / savings.requests) * 100) : 0}%
                </span>
              }
            />
            <ul className="space-y-2 text-sm text-secondary">
              <li>
                Exact/prefix <span className="text-primary">{savings.cache_hits}</span>
              </li>
              <li>
                Similarity <span className="text-primary">{semanticHits}</span>
                {savings.avg_semantic_similarity != null ? (
                  <span className="text-secondary"> · avg {pct(savings.avg_semantic_similarity * 100, 0)}</span>
                ) : null}
              </li>
              <li>
                Escalations <span className="text-primary">{savings.escalations}</span>
              </li>
              <li>
                Gate pass{" "}
                <span className="text-primary">{gateRate == null ? "—" : pct(gateRate * 100, 0)}</span>
              </li>
              <li>
                Audits <span className="text-primary">{auditPasses}/{audits || 0}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {savings.recent.length === 0 ? (
        <p className="mt-12 text-sm text-secondary">
          No traffic yet. Send a request from the{" "}
          <Link href="/console" className="text-primary">
            console
          </Link>{" "}
          or CLI.
        </p>
      ) : (
        <div className="mt-10 overflow-hidden rounded-2xl border border-primary/[0.06]">
          <div className="border-b border-primary/[0.06] bg-card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Recent requests</p>
            <p className="mt-0.5 text-xs text-secondary/80">Click a row to open prompt, routing, and cost detail</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Quality</th>
                  <th className="px-4 py-3 font-medium">API cost</th>
                  <th className="px-4 py-3 font-medium">Saved</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <RecentRequestRows rows={savings.recent} />
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SplitRow({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-secondary">{label}</p>
        <p className="font-display text-lg font-medium text-primary tabular">{value}</p>
      </div>
      <Meter value={share} className="mt-2" />
    </div>
  );
}
