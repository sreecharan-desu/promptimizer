import { ImageResponse } from "next/og";
import { MARK_BG, MARK_END, MARK_GOLD, MARK_INK, MARK_PATH, MARK_START } from "@/components/mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          justifyContent: "center",
          padding: 88,
        }}
      >
        <svg width="64" height="64" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="#141414" />
          <rect
            x="0.5"
            y="0.5"
            width="31"
            height="31"
            rx="7.5"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.16"
          />
          <path d={MARK_PATH} fill="none" stroke={MARK_INK} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx={MARK_START.cx} cy={MARK_START.cy} r="2.3" fill={MARK_INK} />
          <circle cx={MARK_END.cx} cy={MARK_END.cy} r="2.3" fill={MARK_GOLD} />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 64,
            fontWeight: 500,
            letterSpacing: -1.6,
            color: MARK_INK,
          }}
        >
          Promptimizer
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            color: "#8A8A8A",
            lineHeight: 1.4,
            maxWidth: 720,
          }}
        >
          Quality-aware LLM routing for OpenAI-compatible APIs.
        </div>
      </div>
    ),
    size,
  );
}
