import { ImageResponse } from "next/og";
import { MARK_BG, MARK_GOLD, MARK_INK, markGeometry } from "@/components/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const g = markGeometry(180);

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: MARK_BG,
          borderRadius: 40,
          display: "flex",
        }}
      >
        <svg width={180} height={180}>
          <path
            d={g.path}
            fill="none"
            stroke={MARK_INK}
            strokeWidth={g.stroke}
            strokeLinecap="round"
          />
          <circle cx={g.start.cx} cy={g.start.cy} r={g.dot} fill={MARK_INK} />
          <circle cx={g.end.cx} cy={g.end.cy} r={g.dot} fill={MARK_GOLD} />
        </svg>
      </div>
    ),
    size,
  );
}
