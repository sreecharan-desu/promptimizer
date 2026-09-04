import type { ReactNode } from "react";

export function usd(value: number) {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs === 0) return "$0.0000";
  // Frontier baselines and short economy replies often land well under $0.0001 —
  // four decimals falsely reads as "$0.0000" even when routing worked.
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  if (abs >= 0.0001) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

export function pct(value: number, digits = 1) {
  return `${Number.isFinite(value) ? value.toFixed(digits) : "0"}%`;
}

/** Tiny line chart for metric cards. */
export function Sparkline({
  values,
  className = "",
  stroke = "hsl(var(--accent))",
  fill = "hsl(var(--accent) / 0.12)",
}: {
  values: number[];
  className?: string;
  stroke?: string;
  fill?: string;
}) {
  const w = 160;
  const h = 48;
  if (values.length < 2) {
    return <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-12 w-full ${className}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} fill={fill} stroke="none" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Horizontal bars for recent spend series. */
export function MiniBars({
  values,
  highlightLast = true,
  className = "",
}: {
  values: number[];
  highlightLast?: boolean;
  className?: string;
}) {
  const max = Math.max(...values, 1e-9);
  return (
    <div className={`flex h-12 items-end gap-1 ${className}`} aria-hidden="true">
      {values.map((v, i) => {
        const tall = Math.max(8, (v / max) * 100);
        const last = highlightLast && i === values.length - 1;
        return (
          <span
            key={i}
            className={`min-w-[4px] flex-1 rounded-sm ${last ? "bg-accent" : "bg-primary/15"}`}
            style={{ height: `${tall}%` }}
          />
        );
      })}
    </div>
  );
}

/** Simple donut from labeled slices. */
export function Donut({
  slices,
  size = 88,
  thickness = 14,
  center,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary) / 0.08)" strokeWidth={thickness} />
        {slices.map((slice) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {center ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      ) : null}
    </div>
  );
}

export function Meter({ value, className = "" }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-primary/10 ${className}`}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-primary/[0.06] bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-2 font-display text-3xl font-medium tracking-tight text-primary tabular">{value}</p>
      {hint ? <p className="mt-1 text-sm text-secondary">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "bg-primary/[0.06] text-primary/70",
    good: "bg-success/[0.12] text-success",
    warn: "bg-warning/[0.14] text-warning",
    bad: "bg-error/[0.12] text-error",
    accent: "bg-accent/[0.14] text-accent",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
