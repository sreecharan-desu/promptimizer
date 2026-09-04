import type { CSSProperties, ReactNode } from "react";

const SPOT: CSSProperties = {
  ["--spot-paper" as string]: "#FFFFFF",
  ["--spot-ink" as string]: "#2A261C",
  ["--spot-warm" as string]: "#F3D48A",
  ["--spot-cool" as string]: "#C8E6D0",
  ["--spot-cool-light" as string]: "#D8F0DE",
  ["--spot-cool-deep" as string]: "#A8D4B4",
};

function Spot({
  titleId,
  title,
  children,
}: {
  titleId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl bg-white px-4 pb-1 pt-3">
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

export function SimulatorSpot() {
  return (
    <Spot titleId="consoleSim" title="Three quiet models on a desk">
      <Defs prefix="sim" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#simCool)" />
      </g>
      <g transform="translate(280, 252)">
        <path d="M-34 0 L-28 -48 Q-26 -60, -12 -60 H34 Q48 -60, 50 -48 L56 0 Z" fill="url(#simDuotone)" />
        <path d="M50 -44 C74 -40, 76 -14, 50 -12" />
        <path d="M8 -70 C-4 -86, 18 -96, 6 -112 C-6 -128, 16 -140, 10 -156" />
      </g>
      <g transform="translate(520, 252) rotate(14)">
        <path d="M48 -6 L62 6 L62 -148 L48 -160 Z" fill="url(#simCool)" />
        <rect x="-56" y="-160" width="104" height="152" rx="14" fill="var(--spot-paper)" />
        <circle cx="-18" cy="-92" r="5" fill="var(--spot-warm)" stroke="none" />
        <circle cx="0" cy="-92" r="5" fill="var(--spot-warm)" stroke="none" />
        <circle cx="18" cy="-92" r="5" fill="var(--spot-warm)" stroke="none" />
      </g>
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </Spot>
  );
}

export function KeySpot() {
  return (
    <Spot titleId="consoleKey" title="A key card waiting on the desk">
      <Defs prefix="key" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#keyCool)" />
      </g>
      <g transform="translate(320, 252) rotate(-54)">
        <polygon points="0,0 11,-6.5 11,6.5" fill="var(--spot-ink)" stroke="none" />
        <polygon points="10,-7.2 10,7.2 28,7.2 28,-7.2" fill="var(--spot-paper)" />
        <rect x="27" y="-7.2" width="118" height="14.4" rx="2.2" fill="var(--spot-warm)" />
      </g>
      <g transform="translate(528, 252) rotate(10)">
        <path d="M44 -6 L56 6 L56 -96 L44 -108 Z" fill="url(#keyCool)" />
        <rect x="-50" y="-114" width="94" height="108" rx="14" fill="var(--spot-paper)" />
        <circle cx="-8" cy="-70" r="12" />
        <path d="M4 -70 H28 M20 -70 V-52" />
      </g>
      <path d="M568 76 C592 54, 620 54, 642 76 S686 54, 702 64" />
    </Spot>
  );
}

export function EmptyFleetSpot() {
  return (
    <Spot titleId="consoleEmpty" title="A quiet map before the trip">
      <Defs prefix="empty" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#emptyCool)" />
      </g>
      <g transform="translate(300, 252) rotate(-54)">
        <polygon points="0,0 11,-6.5 11,6.5" fill="var(--spot-ink)" stroke="none" />
        <polygon points="10,-7.2 10,7.2 28,7.2 28,-7.2" fill="var(--spot-paper)" />
        <rect x="27" y="-7.2" width="118" height="14.4" rx="2.2" fill="var(--spot-warm)" />
      </g>
      <g transform="translate(520, 252) rotate(-6)">
        <path d="M56 -4 L70 8 L70 -84 L56 -96 Z" fill="url(#emptyCool)" />
        <path d="M-78 0 L-78 -76 L0 -92 L56 -76 L56 0 Z" fill="url(#emptyDuotone)" />
        <path d="M0 -92 L0 0" />
      </g>
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </Spot>
  );
}

export function BenchSpot() {
  return (
    <Spot titleId="consoleBench" title="A card that passed a quiet check">
      <Defs prefix="bench" />
      <path d="M64 252 H656" />
      <g transform="translate(96, 252)">
        <path d="M0 0 C8 -22, 28 -48, 72 -50 C118 -52, 140 -22, 142 0 Z" fill="url(#benchCool)" />
      </g>
      <g transform="translate(268, 252)">
        <path d="M-34 0 L-28 -48 Q-26 -60, -12 -60 H34 Q48 -60, 50 -48 L56 0 Z" fill="url(#benchDuotone)" />
        <path d="M50 -44 C74 -40, 76 -14, 50 -12" />
        <path d="M8 -70 C-4 -86, 18 -96, 6 -112 C-6 -128, 16 -140, 10 -156" />
      </g>
      <g transform="translate(528, 252) rotate(10)">
        <path d="M44 -6 L56 6 L56 -96 L44 -108 Z" fill="url(#benchCool)" />
        <rect x="-50" y="-114" width="94" height="108" rx="14" fill="var(--spot-paper)" />
        <path d="M-18 -58 L-4 -44 L24 -76" />
      </g>
      <circle cx="682" cy="46" r="15" fill="var(--spot-warm)" />
    </Spot>
  );
}
