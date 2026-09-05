"use client";

import { useState } from "react";
import type { UsageEvent } from "@/server/account";
import { LocalWhen } from "./local-when";
import { Meter, Pill, pct, usd } from "./metrics";

function cacheModeLabel(mode: string | undefined, row: UsageEvent) {
  const m = mode ?? (row.cache_hit ? "cache" : row.semantic_hit ? "semantic" : "miss");
  switch (m) {
    case "exact":
      return "Exact cache hit — full answer replayed, no provider call";
    case "prompt":
      return "Prompt cache hit — same prompt reused, no provider call";
    case "prefix":
      return "Prefix cache — shared prefix discounted on the provider call";
    case "semantic_full":
    case "semantic":
      return "Similarity cache — close prompt matched; answer reused";
    case "semantic_hybrid":
      return "Similarity hybrid — reused shared context, then completed novel parts";
    case "cache":
      return "Cache hit — answered from cache";
    default:
      return "Cache miss — live model call";
  }
}

function routingSteps(row: UsageEvent): string[] {
  const d = row.detail;
  const steps: string[] = [];

  const category = d?.category;
  const complexity = d?.complexity;
  if (category || complexity != null) {
    steps.push(
      `1. Classified as ${category ?? "general"}${complexity != null ? ` · complexity L${complexity}` : ""}.`,
    );
  } else {
    steps.push("1. Classified the prompt (complexity / category).");
  }

  const policy = d?.routing_policy ?? "bootstrap_heuristic";
  const initial = d?.initial_model ?? row.model;
  steps.push(
    `2. Policy “${policy.replaceAll("_", " ")}” picked ${initial} (${row.tier} tier).`,
  );

  steps.push(`3. ${cacheModeLabel(d?.cache_mode, row)}.`);
  if (d?.semantic_similarity != null && (row.semantic_hit || d.semantic_cache_hit)) {
    steps.push(`   Similarity ${(d.semantic_similarity * 100).toFixed(0)}%.`);
  }

  const gate = row.quality_gate || "—";
  const q = row.quality != null ? pct(row.quality * 100, 0) : null;
  steps.push(`4. Quality gate ${gate}${q ? ` · score ${q}` : ""}.`);
  if (row.quality_audit) {
    steps.push(
      `   Audit sample: ${row.quality_audit_pass ? "passed" : "flagged"}.`,
    );
  }

  if (row.escalated) {
    const reason = d?.escalation_reason ? ` (${d.escalation_reason})` : "";
    const final = d?.final_model ?? row.model;
    steps.push(`5. Escalated to ${final}${reason}.`);
  } else {
    steps.push(`5. Kept ${d?.final_model ?? row.model} — no escalation.`);
  }

  if (d?.rationale) {
    steps.push(`Summary: ${d.rationale}`);
  }

  return steps;
}

function CostRow({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-0">
      <div>
        <p className={`text-sm ${strong ? "font-medium text-zinc-900" : "text-zinc-600"}`}>{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">{hint}</p> : null}
      </div>
      <p className={`shrink-0 tabular ${strong ? "font-medium text-zinc-900" : "text-zinc-800"}`}>{value}</p>
    </div>
  );
}

function RequestDetail({ row }: { row: UsageEvent }) {
  const d = row.detail;
  const savedPct = row.baseline_usd ? (row.saved_usd / row.baseline_usd) * 100 : 0;
  const steps = routingSteps(row);

  return (
    <div className="rounded-xl bg-white p-5 text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Prompt</p>
          {row.prompt ? (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-100 bg-zinc-50 px-3.5 py-3 font-sans text-[13px] leading-relaxed text-zinc-800">
              {row.prompt}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Prompt was not stored for this request (recorded before detail capture). New requests include the full
              prompt here.
            </p>
          )}
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">How routing worked</p>
          <ol className="mt-2 list-none space-y-2 text-[13px] leading-relaxed text-zinc-700">
            {steps.map((step) => (
              <li key={step} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3.5 py-2.5">
                {step}
              </li>
            ))}
          </ol>
          {d?.request_id ? (
            <p className="mt-3 font-mono text-[11px] text-zinc-400">Request {d.request_id}</p>
          ) : null}
        </section>
      </div>

      <section className="mt-6 border-t border-zinc-100 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Cost analysis</p>
        <div className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3.5 py-1">
          <CostRow
            label="Frontier baseline"
            value={usd(row.baseline_usd)}
            hint={d?.baseline_model ? `If always ${d.baseline_model}` : "Always-frontier estimate"}
          />
          <CostRow
            label="API spend (this call)"
            value={usd(row.actual_usd)}
            hint={row.cache_hit && row.actual_usd === 0 ? "Full cache replay — $0 provider bill" : `Model ${row.model}`}
            strong
          />
          <CostRow
            label="Saved via cheaper model"
            value={usd(row.routing_saved_usd)}
            hint="Baseline − cost of the routed model at full tokens"
          />
          <CostRow
            label="Saved via cache"
            value={usd(row.cache_saved_usd)}
            hint="Avoided or discounted provider tokens"
          />
          <CostRow
            label="Total saved"
            value={`${usd(row.saved_usd)} · ${pct(savedPct, 0)}`}
            hint="Baseline − API spend"
            strong
          />
          {(d?.prompt_tokens != null || d?.completion_tokens != null) && (
            <CostRow
              label="Tokens"
              value={`${d.prompt_tokens ?? "—"} in · ${d.completion_tokens ?? "—"} out${
                d.cached_tokens ? ` · ${d.cached_tokens} cached` : ""
              }`}
            />
          )}
          {d?.estimated_cost_usd != null && (
            <CostRow label="Pre-call estimate" value={usd(d.estimated_cost_usd)} />
          )}
          {d?.latency_ms != null && <CostRow label="Latency" value={`${Math.round(d.latency_ms)} ms`} />}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Share of baseline kept (spend)</span>
            <span className="tabular">{pct(row.baseline_usd ? (row.actual_usd / row.baseline_usd) * 100 : 0, 0)}</span>
          </div>
          <Meter
            value={row.baseline_usd ? Math.min(100, (row.actual_usd / row.baseline_usd) * 100) : 0}
            className="mt-1.5"
          />
        </div>
      </section>
    </div>
  );
}

export function RecentRequestRows({ rows }: { rows: UsageEvent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <tbody key={row.id} className="border-t border-primary/5">
            <tr
              className={`cursor-pointer transition-colors ${open ? "bg-primary/[0.03]" : "hover:bg-primary/[0.02]"}`}
              onClick={() => setOpenId(open ? null : row.id)}
            >
              <td className="px-4 py-3 text-secondary">
                <div className="inline-flex items-center gap-2.5">
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-card text-[11px] font-medium text-primary transition-colors ${
                      open ? "border-accent/40 bg-accent/10 text-accent" : ""
                    }`}
                    aria-hidden
                  >
                    {open ? "−" : "+"}
                  </span>
                  <LocalWhen iso={row.created_at} />
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-[12px] text-primary">{row.model}</td>
              <td className="px-4 py-3">
                <Pill tone={row.tier === "economy" ? "accent" : row.tier === "frontier" ? "warn" : "neutral"}>
                  {row.tier}
                </Pill>
              </td>
              <td className="px-4 py-3">
                {row.quality == null ? (
                  "—"
                ) : (
                  <div className="w-24">
                    <p className="tabular text-primary">{pct(row.quality * 100, 0)}</p>
                    <Meter value={row.quality * 100} className="mt-1" />
                  </div>
                )}
              </td>
              <td className="px-4 py-3 tabular text-secondary">{usd(row.actual_usd)}</td>
              <td className={`px-4 py-3 tabular ${row.saved_usd < 0 ? "text-red-500" : "text-accent"}`}>
                {usd(row.saved_usd)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1">
                  {row.cache_hit ? <Pill tone="good">cache</Pill> : null}
                  {row.semantic_hit ? <Pill tone="accent">similar</Pill> : null}
                  {row.quality_gate === "fail" ? <Pill tone="warn">gate</Pill> : null}
                  {row.quality_audit ? (
                    <Pill tone={row.quality_audit_pass ? "good" : "warn"}>
                      {row.quality_audit_pass ? "audit ok" : "audit"}
                    </Pill>
                  ) : null}
                  {row.escalated ? <Pill tone="warn">escalated</Pill> : null}
                  {!row.cache_hit &&
                  !row.escalated &&
                  !row.semantic_hit &&
                  row.quality_gate !== "fail" &&
                  !row.quality_audit ? (
                    <span className="text-secondary">—</span>
                  ) : null}
                </div>
              </td>
            </tr>
            {open ? (
              <tr>
                <td colSpan={7} className="bg-primary/[0.015] px-4 pb-4 pt-1" onClick={(e) => e.stopPropagation()}>
                  <RequestDetail row={row} />
                </td>
              </tr>
            ) : null}
          </tbody>
        );
      })}
    </>
  );
}
