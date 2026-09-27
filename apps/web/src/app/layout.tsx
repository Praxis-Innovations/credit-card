import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { BRAND_TEAL } from "@/lib/brand";
import "./globals.css";

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

const siteTitle = "NorthTap - The right card for every purchase.";
const siteDescription =
  "NorthTap looks at where you're shopping and tells you which card in your wallet earns the most. Free for Canadian cardholders, no account needed.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  applicationName: "NorthTap",
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: "NorthTap",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
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
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
