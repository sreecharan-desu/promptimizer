import { ImageResponse } from "next/og";
import { MARK_BG, MARK_GOLD, MARK_INK, markGeometry } from "@/components/mark";

export const alt = "Promptimizer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = 112;
const g = markGeometry(MARK);

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: MARK_BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={MARK} height={MARK}>
          <rect width={MARK} height={MARK} rx={g.radius} fill="#161616" />
          <rect
            x={1}
            y={1}
            width={MARK - 2}
            height={MARK - 2}
            rx={g.radius - 1}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
          />
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
        <div
          style={{
            marginTop: 36,
            fontSize: 56,
            fontWeight: 500,
            letterSpacing: -1.4,
            color: MARK_INK,
          }}
        >
          Promptimizer
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 24,
            color: "#8A8A8A",
            letterSpacing: -0.2,
          }}
        >
          Quality-aware LLM routing for OpenAI-compatible APIs.
        </div>
      </div>
    ),
    size,
  );
}
