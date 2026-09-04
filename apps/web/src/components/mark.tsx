export const MARK_BG = "#0A0A0A";
export const MARK_INK = "#FFFFFF";
export const MARK_GOLD = "#C9A24A";
export const MARK_PATH = "M7.85 23.2C10.7 16.15 16.05 9.3 24.1 9.3";
export const MARK_START = { cx: 7.85, cy: 23.2 };
export const MARK_END = { cx: 24.1, cy: 9.3 };
export const MARK_STROKE = 2.6;
export const MARK_DOT = 2.3;

export function markGeometry(size: number) {
  const k = size / 32;
  return {
    size,
    radius: 8 * k,
    path: `M${7.85 * k} ${23.2 * k}C${10.7 * k} ${16.15 * k} ${16.05 * k} ${9.3 * k} ${24.1 * k} ${9.3 * k}`,
    start: { cx: 7.85 * k, cy: 23.2 * k },
    end: { cx: 24.1 * k, cy: 9.3 * k },
    stroke: 2.6 * k,
    dot: 2.3 * k,
  };
}

export function MarkArtwork() {
  return (
    <>
      <path
        d={MARK_PATH}
        fill="none"
        stroke={MARK_INK}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
      />
      <circle cx={MARK_START.cx} cy={MARK_START.cy} r={MARK_DOT} fill={MARK_INK} />
      <circle cx={MARK_END.cx} cy={MARK_END.cy} r={MARK_DOT} fill={MARK_GOLD} />
    </>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#161616" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
      />
      <MarkArtwork />
    </svg>
  );
}
