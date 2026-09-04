export function EmptySpot() {
  return (
    <figure className="mx-auto flex max-w-[560px] justify-center px-6 pb-2 pt-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 720 320"
        fill="none"
        stroke="var(--spot-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-labelledby="spotTitle"
        className="h-auto w-full"
        style={
          {
            "--spot-paper": "#FFFFFF",
            "--spot-ink": "#2A261C",
            "--spot-warm": "#F3D48A",
            "--spot-cool": "#C8E6D0",
            "--spot-cool-light": "#D8F0DE",
            "--spot-cool-deep": "#A8D4B4",
          } as React.CSSProperties
        }
      >
        <title id="spotTitle">A quiet desk ready to route keys</title>
        <defs>
          <linearGradient id="coolEdge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--spot-cool-light)" />
            <stop offset="1" stopColor="var(--spot-cool-deep)" />
          </linearGradient>
        </defs>
        <line x1="80" y1="252" x2="640" y2="252" />
        <circle cx="118" cy="246" r="7" fill="var(--spot-warm)" />
        <g transform="translate(210, 252)">
          <rect x="-46" y="-70" width="92" height="70" rx="10" fill="var(--spot-warm)" />
          <rect x="-34" y="-56" width="68" height="38" rx="4" fill="url(#coolEdge)" stroke="var(--spot-ink)" />
          <path d="M-18 -42h36M-18 -32h22" />
        </g>
        <g transform="translate(360, 252)">
          <rect x="-70" y="-108" width="150" height="108" rx="14" fill="url(#coolEdge)" />
          <path d="M-48 -78h70M-48 -62h46" />
          <circle cx="48" cy="-78" r="7" fill="var(--spot-warm)" />
        </g>
        <g transform="translate(530, 252)">
          <path d="M-18 0v-44c0-14 10-22 22-22h8" fill="var(--spot-warm)" />
          <path d="M12 -66c14 0 18 10 18 18" />
        </g>
        <circle cx="600" cy="78" r="16" fill="var(--spot-warm)" />
      </svg>
    </figure>
  );
}
