import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_OFF_WHITE, BRAND_TEAL } from "@/lib/brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Alt text for a page's OG image, which shows the logo and the page's h1. */
export function ogImageAlt(h1: string): string {
  return `NorthTap logo above the headline: ${h1}`;
}

/*
 * next/og can't read woff2, so the OG fonts are committed woff files
 * (Syne 600, DM Sans 500; OFL, see src/assets/fonts). Paths stay literal
 * process.cwd() joins so output file tracing can find them.
 */
export async function renderOgImage(h1: string): Promise<ImageResponse> {
  const [syne, dmSans, mark] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/syne-latin-600-normal.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/dm-sans-latin-500-normal.woff")),
    readFile(join(process.cwd(), "public/brand/northtap-mark.svg")),
  ]);
  const markSrc = `data:image/svg+xml;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: BRAND_OFF_WHITE,
          borderTop: `16px solid ${BRAND_TEAL}`,
          fontFamily: "DM Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={markSrc} width={106} height={76} />
          <div
            style={{
              display: "flex",
              fontFamily: "Syne",
              fontSize: 52,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "#141816" }}>North</span>
            <span style={{ color: BRAND_TEAL }}>Tap</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Syne",
            fontSize: h1.length > 44 ? 68 : 80,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "#141816",
            maxWidth: 1000,
          }}
        >
          {h1}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#4a524e" }}>
          Free for Canadian cardholders · no bank login
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Syne", data: syne, weight: 600, style: "normal" },
        { name: "DM Sans", data: dmSans, weight: 500, style: "normal" },
      ],
    },
  );
}
