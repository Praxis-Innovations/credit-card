import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

const siteTitle = "NorthTap - Tap the right card, every time.";
const siteDescription =
  "Canadian credit card rewards optimizer. Pick your wallet, pick a category, see which card earns the most cents back per dollar.";

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
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
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
      className={`${dmSans.variable} ${syne.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="grain-overlay" aria-hidden />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
