import type { CSSProperties, ReactNode } from "react";

const SPOT: CSSProperties = {
  ["--spot-paper" as string]: "#14181f",
  ["--spot-ink" as string]: "#E8EEF2",
  ["--spot-warm" as string]: "#5EEAD4",
  ["--spot-cool" as string]: "#64748B",
  ["--spot-cool-light" as string]: "#94A3B8",
  ["--spot-glow" as string]: "#2DD4BF",
};

function SpotShell({
  titleId,
  title,
  children,
  className = "",
}: {
  titleId: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={`glass-panel overflow-hidden rounded-2xl border border-primary/[0.08] bg-[#0d1015]/80 ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 720 320"
        fill="none"
        stroke="var(--spot-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-labelledby={titleId}
        className="h-auto w-full"
        style={SPOT}
      >
        <title id={titleId}>{title}</title>
        <defs>
          <linearGradient id={`${titleId}Mint`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--spot-warm)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--spot-glow)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id={`${titleId}Glass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c2330" />
            <stop offset="1" stopColor="#10141b" />
          </linearGradient>
          <radialGradient id={`${titleId}Aura`} cx="50%" cy="38%" r="58%">
            <stop offset="0" stopColor="var(--spot-warm)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--spot-warm)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="720" height="320" fill={`url(#${titleId}Aura)`} stroke="none" />
        {children}
      </svg>
    </figure>
  );
}

export function SimulatorSpot() {
  return (
    <SpotShell titleId="consoleSim" title="Model tiers on a glass stage">
      <path d="M120 220 H600" stroke="var(--spot-cool)" strokeOpacity="0.35" />
      <rect x="150" y="88" width="120" height="132" rx="18" fill="url(#consoleSimGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.35" />
      <rect x="300" y="64" width="120" height="156" rx="18" fill="url(#consoleSimGlass)" stroke="var(--spot-warm)" strokeOpacity="0.55" />
      <rect x="450" y="100" width="120" height="120" rx="18" fill="url(#consoleSimGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.35" />
      <circle cx="210" cy="154" r="10" fill="url(#consoleSimMint)" stroke="none" />
      <circle cx="360" cy="142" r="14" fill="url(#consoleSimMint)" stroke="none" />
      <circle cx="510" cy="160" r="10" fill="var(--spot-cool)" stroke="none" />
      <path d="M230 154 H346" stroke="var(--spot-warm)" strokeOpacity="0.7" />
      <path d="M374 142 H496" stroke="var(--spot-cool-light)" strokeOpacity="0.45" strokeDasharray="5 6" />
    </SpotShell>
  );
}

export function KeySpot() {
  return (
    <SpotShell titleId="consoleKey" title="A glass key unlocking the fleet">
      <path d="M90 170 H280" stroke="var(--spot-cool)" strokeOpacity="0.35" />
      <path d="M280 170 C360 170, 380 110, 460 110 H630" stroke="var(--spot-warm)" strokeOpacity="0.65" />
      <path d="M280 170 C360 170, 390 230, 470 230 H630" stroke="var(--spot-cool-light)" strokeOpacity="0.4" strokeDasharray="4 7" />
      <circle cx="90" cy="170" r="13" fill="url(#consoleKeyMint)" stroke="none" />
      <circle cx="280" cy="170" r="9" fill="var(--spot-paper)" stroke="var(--spot-warm)" />
      <circle cx="460" cy="110" r="8" fill="var(--spot-paper)" stroke="var(--spot-cool-light)" strokeOpacity="0.5" />
      <circle cx="470" cy="230" r="8" fill="var(--spot-paper)" stroke="var(--spot-cool-light)" strokeOpacity="0.5" />
      <circle cx="630" cy="110" r="7" fill="var(--spot-warm)" stroke="none" />
      <circle cx="630" cy="230" r="7" fill="var(--spot-cool)" stroke="none" />
      <g transform="translate(470, 150) rotate(-18)">
        <rect x="-70" y="-44" width="140" height="88" rx="16" fill="url(#consoleKeyGlass)" stroke="var(--spot-warm)" strokeOpacity="0.55" />
        <rect x="-70" y="-44" width="140" height="88" rx="16" fill="var(--spot-warm)" fillOpacity="0.06" stroke="none" />
        <circle cx="-28" cy="-4" r="14" stroke="var(--spot-warm)" />
        <path d="M-14 -4 H42 M28 -4 V16" stroke="var(--spot-warm)" />
        <path d="M-48 28 H48" stroke="var(--spot-cool-light)" strokeOpacity="0.35" />
      </g>
    </SpotShell>
  );
}

export function EmptyFleetSpot() {
  return (
    <SpotShell titleId="consoleEmpty" title="Routes waiting for a host">
      <path
        d="M120 200 C220 120, 320 260, 420 160 S560 80, 620 140"
        stroke="var(--spot-cool-light)"
        strokeOpacity="0.35"
        strokeDasharray="6 8"
      />
      <path
        d="M140 240 C250 220, 340 100, 460 180 S580 260, 640 210"
        stroke="var(--spot-warm)"
        strokeOpacity="0.45"
        strokeDasharray="5 9"
      />
      <circle cx="120" cy="200" r="11" fill="var(--spot-paper)" stroke="var(--spot-cool-light)" strokeOpacity="0.5" />
      <circle cx="420" cy="160" r="16" fill="url(#consoleEmptyGlass)" stroke="var(--spot-warm)" strokeOpacity="0.7" />
      <circle cx="420" cy="160" r="5" fill="var(--spot-warm)" stroke="none" />
      <circle cx="620" cy="140" r="9" fill="var(--spot-paper)" stroke="var(--spot-cool)" strokeOpacity="0.5" />
      <circle cx="640" cy="210" r="9" fill="var(--spot-paper)" stroke="var(--spot-cool)" strokeOpacity="0.5" />
      <circle cx="420" cy="160" r="34" stroke="var(--spot-warm)" strokeOpacity="0.25" strokeDasharray="3 5" />
      <path d="M408 160 H432 M420 148 V172" stroke="var(--spot-warm)" strokeWidth="2" />
    </SpotShell>
  );
}

export function BenchSpot() {
  return (
    <SpotShell titleId="consoleBench" title="Quality gate clearing a path">
      <rect x="160" y="70" width="400" height="180" rx="24" fill="url(#consoleBenchGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.3" />
      <path d="M200 160 H360" stroke="var(--spot-cool)" strokeOpacity="0.4" />
      <path d="M360 160 H520" stroke="var(--spot-warm)" strokeOpacity="0.85" />
      <circle cx="200" cy="160" r="10" fill="var(--spot-cool)" stroke="none" />
      <circle cx="360" cy="160" r="14" fill="url(#consoleBenchMint)" stroke="none" />
      <g transform="translate(520, 160)">
        <circle r="22" fill="var(--spot-paper)" stroke="var(--spot-warm)" />
        <path d="M-8 0 L-2 8 L12 -10" stroke="var(--spot-warm)" strokeWidth="2.2" />
      </g>
    </SpotShell>
  );
}
