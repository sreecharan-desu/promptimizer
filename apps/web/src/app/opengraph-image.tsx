import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0A0A0A",
          color: "#FAFAFA",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, textTransform: "uppercase", opacity: 0.55 }}>
          promptimizer.site
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 600, letterSpacing: -2, lineHeight: 1.05 }}>
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.72, maxWidth: 860, lineHeight: 1.35 }}>
            {SITE_TAGLINE}. Route cheap when safe, escalate when hard, cache what repeats.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, opacity: 0.5 }}>
          BYOK · OpenAI-compatible · quality gate
        </div>
      </div>
    ),
    { ...size },
  );
}
