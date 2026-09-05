import type { ReactNode } from "react";

export const AUTH_FIELD =
  "auth-field mt-1 h-11 w-full rounded-xl border px-3 text-sm text-primary outline-none placeholder:text-secondary";

export function AuthPanel({
  title,
  dek,
  children,
}: {
  title: string;
  dek: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell px-4 sm:px-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.6rem] border border-primary/[0.08] lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="auth-visual relative hidden min-h-[36rem] overflow-hidden p-9 text-white lg:flex lg:flex-col">
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-medium text-white/75">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.14)]" />
              Your routing layer
            </span>
            <h2 className="mt-7 max-w-sm font-display text-4xl font-semibold leading-[1.04] tracking-[-0.05em]">
              Make model behavior operational.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/60">
              Connect your providers once. Review every routing decision, every quality check, and every dollar of spend.
            </p>
          </div>
          <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/45">Request decision</p>
              <span className="rounded-full bg-white/[0.08] px-2 py-1 text-[10px] text-white/70">Passed</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.09] font-mono text-xs font-semibold text-white/80">AI</span>
              <div>
                <p className="text-sm font-medium text-white/90">Frontier reasoning</p>
                <p className="mt-0.5 text-[11px] text-white/45">selected after quality scoring</p>
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full bg-[#7ea88a]" />
            </div>
          </div>
        </aside>
        <div className="auth-card p-6 sm:p-10 lg:px-12 lg:py-11">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Promptimizer</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-primary">{title}</h1>
          <p className="mt-3 max-w-md leading-7 text-secondary">{dek}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
