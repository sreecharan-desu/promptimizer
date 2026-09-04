import type { CSSProperties, ReactNode } from "react";

const SPOT: CSSProperties = {
  ["--spot-paper" as string]: "#FFFFFF",
  ["--spot-ink" as string]: "#2A261C",
  ["--spot-warm" as string]: "#F3D48A",
  ["--spot-cool" as string]: "#C8E6D0",
  ["--spot-cool-light" as string]: "#D8F0DE",
  ["--spot-cool-deep" as string]: "#A8D4B4",
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
    <figure className={`overflow-hidden rounded-2xl bg-white ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 720 320"
        fill="none"
        stroke="var(--spot-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-labelledby={titleId}
        className="h-auto w-full"
        style={SPOT}
      >
        <title id={titleId}>{title}</title>
        {children}
      </svg>
    </figure>
  );
}

function Defs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <linearGradient id={`${prefix}Duotone`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--spot-warm)" />
        <stop offset="1" stopColor="var(--spot-cool)" />
      </linearGradient>
      <linearGradient id={`${prefix}Cool`} x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor="var(--spot-cool-light)" />
        <stop offset="1" stopColor="var(--spot-cool-deep)" />
      </linearGradient>
    </defs>
  );
}

/** Hero: three tiers on a tablet — the product in one glance. */
export function HeroSpot() {
  return (
    <SpotBoard titleId="homeHero" title="Three quiet roads on one desk" className="px-5 pb-2 pt-8 sm:px-6 sm:pt-10">
      <Defs prefix="hero" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#heroCool)" />
      </g>
      <g transform="translate(268, 252)">
        <path d="M-34 0 L-28 -48 Q-26 -60, -12 -60 H34 Q48 -60, 50 -48 L56 0 Z" fill="url(#heroDuotone)" />
        <path d="M50 -44 C74 -40, 76 -14, 50 -12" />
        <path d="M8 -70 C-4 -86, 18 -96, 6 -112 C-6 -128, 16 -140, 10 -156" />
      </g>
      <g transform="translate(356, 252) rotate(-54)">
        <polygon points="0,0 11,-6.5 11,6.5" fill="var(--spot-ink)" stroke="none" />
        <polygon points="10,-7.2 10,7.2 28,7.2 28,-7.2" fill="var(--spot-paper)" />
        <rect x="27" y="-7.2" width="118" height="14.4" rx="2.2" fill="var(--spot-warm)" />
      </g>
      <g transform="translate(528, 252) rotate(16)">
        <path d="M50 -8 L64 4 L64 -164 L50 -176 Z" fill="url(#heroCool)" />
        <rect x="-62" y="-176" width="112" height="168" rx="14" fill="var(--spot-paper)" />
        <circle cx="-20" cy="-92" r="6" fill="var(--spot-warm)" stroke="none" />
        <circle cx="0" cy="-92" r="6" fill="url(#heroDuotone)" stroke="none" />
        <circle cx="20" cy="-92" r="6" fill="url(#heroCool)" stroke="none" />
      </g>
      <path d="M568 76 C592 54, 620 54, 642 76 S686 54, 702 64" />
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </SpotBoard>
  );
}

/** Classify: find the right stack. */
export function ClassifySpot() {
  return (
    <SpotBoard titleId="homeClassify" title="Sorting a quiet stack of notes" className="px-5 pb-1 pt-5">
      <Defs prefix="cls" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#clsCool)" />
      </g>
      <g transform="translate(280, 252) rotate(8)">
        <rect x="-48" y="-70" width="90" height="64" rx="8" fill="url(#clsCool)" />
        <rect x="-54" y="-64" width="90" height="64" rx="8" fill="var(--spot-paper)" />
        <path d="M-34 -42 H16 M-34 -28 H8" />
      </g>
      <g transform="translate(488, 252) rotate(-36)">
        <circle cx="46" cy="-46" r="38" fill="var(--spot-paper)" />
        <circle cx="46" cy="-46" r="18" />
        <path d="M20 -20 L0 0" />
      </g>
      <path d="M568 76 C592 54, 620 54, 642 76 S686 54, 702 64" />
    </SpotBoard>
  );
}

/** Route: the shorter road. */
export function RouteSpot() {
  return (
    <SpotBoard titleId="homeRoute" title="A map choosing the shorter road" className="px-5 pb-1 pt-5">
      <Defs prefix="rte" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#rteCool)" />
      </g>
      <g transform="translate(320, 252) rotate(-54)">
        <polygon points="0,0 11,-6.5 11,6.5" fill="var(--spot-ink)" stroke="none" />
        <polygon points="10,-7.2 10,7.2 28,7.2 28,-7.2" fill="var(--spot-paper)" />
        <rect x="27" y="-7.2" width="118" height="14.4" rx="2.2" fill="var(--spot-warm)" />
      </g>
      <g transform="translate(528, 252) rotate(-6)">
        <path d="M56 -4 L70 8 L70 -84 L56 -96 Z" fill="url(#rteCool)" />
        <path d="M-78 0 L-78 -76 L0 -92 L56 -76 L56 0 Z" fill="url(#rteDuotone)" />
        <path d="M0 -92 L0 0" />
      </g>
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </SpotBoard>
  );
}

/** Save: keep the pages, keep the coin. */
export function SaveSpot() {
  return (
    <SpotBoard titleId="homeSave" title="A folder and a coin left on the desk" className="px-5 pb-1 pt-5">
      <Defs prefix="sav" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#savCool)" />
      </g>
      <g transform="translate(300, 252) rotate(8)">
        <rect x="-64" y="-78" width="86" height="68" rx="8" fill="url(#savDuotone)" />
        <path d="M48 -4 L60 8 L60 -90 L48 -102 Z" fill="url(#savCool)" />
        <path d="M-56 0 L-56 -72 L-18 -72 L-4 -90 L48 -90 L48 0 Z" fill="var(--spot-paper)" />
      </g>
      <g transform="translate(520, 252)">
        <circle cx="0" cy="-44" r="40" fill="var(--spot-warm)" />
      </g>
      <path d="M568 76 C592 54, 620 54, 642 76 S686 54, 702 64" />
    </SpotBoard>
  );
}

/** Docs / start: a standing card with a check. */
export function StartSpot() {
  return (
    <SpotBoard titleId="homeStart" title="A card that passed a quiet check" className="px-5 pb-1 pt-5">
      <Defs prefix="str" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#strCool)" />
      </g>
      <g transform="translate(280, 252)">
        <path d="M-34 0 L-28 -48 Q-26 -60, -12 -60 H34 Q48 -60, 50 -48 L56 0 Z" fill="url(#strDuotone)" />
        <path d="M50 -44 C74 -40, 76 -14, 50 -12" />
        <path d="M8 -70 C-4 -86, 18 -96, 6 -112 C-6 -128, 16 -140, 10 -156" />
      </g>
      <g transform="translate(528, 252) rotate(10)">
        <path d="M44 -6 L56 6 L56 -96 L44 -108 Z" fill="url(#strCool)" />
        <rect x="-50" y="-114" width="94" height="108" rx="14" fill="var(--spot-paper)" />
        <path d="M-18 -58 L-4 -44 L24 -76" />
      </g>
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </SpotBoard>
  );
}
