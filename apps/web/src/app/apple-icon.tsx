import { ImageResponse } from "next/og";
import { MARK_BG, MARK_END, MARK_GOLD, MARK_INK, MARK_PATH, MARK_START } from "@/components/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path d={MARK_PATH} fill="none" stroke={MARK_INK} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx={MARK_START.cx} cy={MARK_START.cy} r="2.3" fill={MARK_INK} />
          <circle cx={MARK_END.cx} cy={MARK_END.cy} r="2.3" fill={MARK_GOLD} />
        </svg>
      </div>
    ),
    size,
  );
}
