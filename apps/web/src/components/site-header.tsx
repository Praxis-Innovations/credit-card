"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-baseline gap-2.5">
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            NorthTap
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            Canada
          </span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="#optimizer"
            className="hidden px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Try it free
          </a>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
