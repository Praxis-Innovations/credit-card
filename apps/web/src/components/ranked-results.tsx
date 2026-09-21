"use client";

import type { Recommendation } from "@northtap/core";
import { formatCentsPerDollar, cn } from "@/lib/utils";

interface RankedResultsProps {
  recommendations: Recommendation[];
  emptyHint: string;
}

export function RankedResults({
  recommendations,
  emptyHint,
}: RankedResultsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {emptyHint}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2.5">
      {recommendations.map((rec, index) => {
        const isTop = index === 0;
        return (
          <li
            key={rec.card.id}
            className={cn(
              "relative overflow-hidden border px-4 py-4 sm:px-5",
              isTop
                ? "border-transparent text-[var(--result-top-fg)]"
                : "border-border bg-card text-foreground",
            )}
            style={
              isTop
                ? { backgroundColor: "var(--result-top)" }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "font-mono-nums inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-bold",
                      isTop
                        ? "bg-white/15 text-[var(--result-top-fg)]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      isTop
                        ? "text-[var(--result-top-fg)]/75"
                        : "text-muted-foreground",
                    )}
                  >
                    {rec.card.issuer}
                  </p>
                </div>
                <h3
                  className={cn(
                    "mt-2 font-display text-xl tracking-tight sm:text-2xl",
                    isTop
                      ? "text-[var(--result-top-fg)]"
                      : "text-foreground",
                  )}
                >
                  {rec.card.name}
                </h3>
                <p
                  className={cn(
                    "mt-1 text-sm leading-relaxed",
                    isTop
                      ? "text-[var(--result-top-fg)]/80"
                      : "text-muted-foreground",
                  )}
                >
                  {rec.reason}
                  {rec.capExhausted ? " · cap exhausted" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "font-mono-nums text-2xl font-semibold tracking-tight sm:text-3xl",
                    isTop ? "text-highlight" : "text-primary",
                  )}
                >
                  {formatCentsPerDollar(rec.centsPerDollar)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[11px] font-medium",
                    isTop
                      ? "text-[var(--result-top-fg)]/65"
                      : "text-muted-foreground",
                  )}
                >
                  back
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
