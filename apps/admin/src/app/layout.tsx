import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NorthTap Admin", template: "%s · NorthTap Admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0c5c56",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="en-CA" className={`${dmSans.variable} ${syne.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
