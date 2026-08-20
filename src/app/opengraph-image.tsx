import { ImageResponse } from "next/og";

// Static generation (build-time, then cached) is the default here since
// nothing below depends on request-time data — same image for every share.
export const alt = "After Atlas — a free, guided checklist for closing out an estate after a death";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Code-generated rather than a static upload so the card always matches
 * the site's actual brand colors (see globals.css) and the wordmark/
 * tagline can be edited here instead of round-tripping through an image
 * editor. No custom font file — satori's bundled default renders the bold
 * sans cleanly at this size, and skipping a font asset keeps this well
 * under ImageResponse's 500KB bundle budget.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#fdf0ea",
          backgroundImage: "linear-gradient(135deg, #fdf0ea 0%, #f8d9cf 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 92,
            height: 92,
            borderRadius: "9999px",
            backgroundColor: "#6d3fc0",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l5 5L19 7"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 108,
              fontWeight: 700,
              color: "#4a2a86",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            After Atlas
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 38,
              fontWeight: 500,
              color: "#3a2f2a",
              maxWidth: 880,
              lineHeight: 1.35,
            }}
          >
            A free, guided checklist for closing out an estate after a death.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
