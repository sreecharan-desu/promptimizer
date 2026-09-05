"use client";

import { useMemo, useState } from "react";
import type { UsageEvent } from "@/server/account";
import { RecentRequestRows } from "./portal-request-rows";

const PAGE_SIZE = 12;

type TierFilter = "all" | "economy" | "standard" | "frontier";
type FlagFilter = "all" | "cache" | "similar" | "escalated" | "gate_fail" | "miss";

function matchesFlag(row: UsageEvent, flag: FlagFilter) {
  if (flag === "all") return true;
  if (flag === "cache") return Boolean(row.cache_hit);
  if (flag === "similar") return Boolean(row.semantic_hit);
  if (flag === "escalated") return Boolean(row.escalated);
  if (flag === "gate_fail") return row.quality_gate === "fail";
  if (flag === "miss") return !row.cache_hit && !row.semantic_hit;
  return true;
}

const selectClass =
  "h-9 rounded-lg border border-primary/10 bg-background px-2.5 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
const inputClass =
  "h-9 w-full min-w-[10rem] rounded-lg border border-primary/10 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent/40 sm:max-w-[14rem]";

export function RecentRequestsPanel({ rows }: { rows: UsageEvent[] }) {
  const [tier, setTier] = useState<TierFilter>("all");
  const [flag, setFlag] = useState<FlagFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (tier !== "all" && row.tier !== tier) return false;
      if (!matchesFlag(row, flag)) return false;
      if (q) {
        const hay = `${row.model} ${row.prompt ?? ""} ${row.tier}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tier, flag, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-primary/[0.06]">
      <div className="border-b border-primary/[0.06] bg-card px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">Recent requests</p>
            <p className="mt-0.5 text-xs text-secondary/80">
              Click a row to open prompt, routing, and cost detail
            </p>
          </div>
          <p className="text-xs tabular text-secondary">
            {filtered.length === rows.length
              ? `${rows.length} loaded`
              : `${filtered.length} of ${rows.length} match`}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="portal-tier-filter">
            Tier
          </label>
          <select
            id="portal-tier-filter"
            className={selectClass}
            value={tier}
            onChange={(e) => {
              setTier(e.target.value as TierFilter);
              resetPage();
            }}
          >
            <option value="all">All tiers</option>
            <option value="economy">Economy</option>
            <option value="standard">Standard</option>
            <option value="frontier">Frontier</option>
          </select>

          <label className="sr-only" htmlFor="portal-flag-filter">
            Flags
          </label>
          <select
            id="portal-flag-filter"
            className={selectClass}
            value={flag}
            onChange={(e) => {
              setFlag(e.target.value as FlagFilter);
              resetPage();
            }}
          >
            <option value="all">All flags</option>
            <option value="cache">Cache hit</option>
            <option value="similar">Similarity</option>
            <option value="escalated">Escalated</option>
            <option value="gate_fail">Gate fail</option>
            <option value="miss">Cache miss</option>
          </select>

          <label className="sr-only" htmlFor="portal-search">
            Search
          </label>
          <input
            id="portal-search"
            className={inputClass}
            placeholder="Search model or prompt"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
          />

          {(tier !== "all" || flag !== "all" || query.trim()) && (
            <button
              type="button"
              className="h-9 rounded-lg px-2.5 text-sm text-secondary transition-colors hover:text-primary"
              onClick={() => {
                setTier("all");
                setFlag("all");
                setQuery("");
                resetPage();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-secondary">No requests match these filters.</p>
      ) : (
        <>
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
              <RecentRequestRows rows={slice} />
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/[0.06] bg-card px-4 py-3">
            <p className="text-xs tabular text-secondary">
              Showing {from}–{to} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 0}
                className="h-8 rounded-lg border border-primary/10 px-3 text-sm text-primary transition-colors enabled:hover:bg-primary/[0.03] disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, Math.min(p, pageCount - 1) - 1))}
              >
                Previous
              </button>
              <span className="min-w-[4.5rem] text-center text-xs tabular text-secondary">
                Page {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                className="h-8 rounded-lg border border-primary/10 px-3 text-sm text-primary transition-colors enabled:hover:bg-primary/[0.03] disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(pageCount - 1, Math.min(p, pageCount - 1) + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
