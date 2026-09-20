import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const siteTitle = "NorthTap — Tap the right card, every time.";
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
    <html lang="en-CA" suppressHydrationWarning>
      <body className={`${outfit.variable} ${fraunces.variable} font-sans`}>
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
