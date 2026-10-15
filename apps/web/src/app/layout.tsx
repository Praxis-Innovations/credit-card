import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { BRAND_TEAL } from "@/lib/brand";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/lib/home";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/*
 * next/font/google downloads Syne and DM Sans at build time and serves them
 * from /_next/static/media, so the browser never requests Google Fonts.
 */

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-syne",
  display: "swap",
});

/** Fallbacks only; every page sets its own metadata with pageMetadata(). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_TEAL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactNode {
  return (
    <html
      lang="en-CA"
      suppressHydrationWarning
      className={`${dmSans.variable} ${syne.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
