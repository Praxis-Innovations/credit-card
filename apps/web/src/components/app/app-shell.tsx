"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  children,
  subtitle = "Purchase recommender",
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <Link
              href="/app"
              className="font-display text-2xl tracking-tight text-foreground"
            >
              NorthTap
            </Link>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Marketing site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
