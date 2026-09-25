import type { CSSProperties, ReactNode } from "react";

const SPOT: CSSProperties = {
  ["--spot-paper" as string]: "#14181f",
  ["--spot-ink" as string]: "#E8EEF2",
  ["--spot-warm" as string]: "#5EEAD4",
  ["--spot-cool" as string]: "#64748B",
  ["--spot-cool-light" as string]: "#94A3B8",
  ["--spot-glow" as string]: "#2DD4BF",
};

function SpotBoard({
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
      className={`glass-panel overflow-hidden rounded-2xl border border-primary/[0.08] bg-[#0d1015]/85 ${className}`}
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
          <radialGradient id={`${titleId}Aura`} cx="50%" cy="40%" r="55%">
            <stop offset="0" stopColor="var(--spot-warm)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--spot-warm)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="720" height="320" fill={`url(#${titleId}Aura)`} stroke="none" />
        {children}
      </svg>
    </figure>
  );
}

export function HeroSpot() {
  return (
    <SpotBoard titleId="homeHero" title="Three routes converging on one glass panel" className="home-hero-spot">
      <rect x="190" y="58" width="340" height="204" rx="28" fill="url(#homeHeroGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.35" />
      <path d="M80 220 C160 220, 180 160, 260 160" stroke="var(--spot-cool)" strokeOpacity="0.5" />
      <path d="M80 160 C150 160, 170 160, 260 160" stroke="var(--spot-warm)" strokeOpacity="0.8" />
      <path d="M80 100 C160 100, 190 160, 260 160" stroke="var(--spot-cool-light)" strokeOpacity="0.45" strokeDasharray="5 6" />
      <circle cx="80" cy="220" r="8" fill="var(--spot-cool)" stroke="none" />
      <circle cx="80" cy="160" r="10" fill="url(#homeHeroMint)" stroke="none" />
      <circle cx="80" cy="100" r="8" fill="var(--spot-cool-light)" stroke="none" />
      <circle cx="360" cy="160" r="22" fill="url(#homeHeroMint)" stroke="none" />
      <circle cx="360" cy="160" r="8" fill="var(--spot-paper)" stroke="none" />
      <path d="M382 160 H560" stroke="var(--spot-warm)" strokeOpacity="0.7" />
      <circle cx="580" cy="160" r="14" fill="var(--spot-paper)" stroke="var(--spot-warm)" />
    </SpotBoard>
  );
}

export function ClassifySpot() {
  return (
    <SpotBoard titleId="homeClassify" title="Signals sorted into three lanes">
      <rect x="120" y="70" width="480" height="180" rx="22" fill="url(#homeClassifyGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.28" />
      <path d="M180 160 H300" stroke="var(--spot-cool)" strokeOpacity="0.45" />
      <path d="M300 160 H420" stroke="var(--spot-warm)" strokeOpacity="0.8" />
      <path d="M420 160 H540" stroke="var(--spot-cool-light)" strokeOpacity="0.45" />
      <circle cx="180" cy="160" r="18" fill="var(--spot-paper)" stroke="var(--spot-cool)" />
      <circle cx="300" cy="160" r="22" fill="url(#homeClassifyMint)" stroke="none" />
      <circle cx="420" cy="160" r="18" fill="var(--spot-paper)" stroke="var(--spot-warm)" strokeOpacity="0.6" />
      <circle cx="540" cy="160" r="18" fill="var(--spot-paper)" stroke="var(--spot-cool-light)" strokeOpacity="0.5" />
    </SpotBoard>
  );
}

export function RouteSpot() {
  return (
    <SpotBoard titleId="homeRoute" title="The shorter mint path wins">
      <path d="M100 220 C220 80, 360 260, 500 120 S640 80, 660 140" stroke="var(--spot-cool)" strokeOpacity="0.3" strokeDasharray="5 7" />
      <path d="M100 200 C240 200, 320 140, 420 140 H640" stroke="var(--spot-warm)" strokeOpacity="0.85" />
      <circle cx="100" cy="200" r="12" fill="url(#homeRouteMint)" stroke="none" />
      <circle cx="420" cy="140" r="10" fill="var(--spot-paper)" stroke="var(--spot-warm)" />
      <circle cx="640" cy="140" r="14" fill="url(#homeRouteMint)" stroke="none" />
    </SpotBoard>
  );
}

export function SaveSpot() {
  return (
    <SpotBoard titleId="homeSave" title="Cache hits stacking as mint bars">
      <rect x="180" y="200" width="48" height="40" rx="8" fill="url(#homeSaveGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.35" />
      <rect x="250" y="160" width="48" height="80" rx="8" fill="url(#homeSaveGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.4" />
      <rect x="320" y="110" width="48" height="130" rx="8" fill="url(#homeSaveMint)" stroke="none" />
      <rect x="390" y="140" width="48" height="100" rx="8" fill="url(#homeSaveGlass)" stroke="var(--spot-warm)" strokeOpacity="0.45" />
      <rect x="460" y="90" width="48" height="150" rx="8" fill="url(#homeSaveMint)" stroke="none" opacity="0.75" />
      <path d="M160 240 H540" stroke="var(--spot-cool)" strokeOpacity="0.35" />
    </SpotBoard>
  );
}

export function StartSpot() {
  return (
    <SpotBoard titleId="homeStart" title="A cleared gate on the glass board">
      <rect x="200" y="70" width="320" height="180" rx="24" fill="url(#homeStartGlass)" stroke="var(--spot-cool-light)" strokeOpacity="0.3" />
      <circle cx="360" cy="160" r="46" stroke="var(--spot-warm)" strokeOpacity="0.35" />
      <circle cx="360" cy="160" r="28" fill="url(#homeStartMint)" stroke="none" />
      <path d="M346 160 L356 172 L380 142" stroke="var(--spot-paper)" strokeWidth="2.4" />
    </SpotBoard>
  );
}
