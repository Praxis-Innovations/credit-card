"use client";

import type { Recommendation } from "@cardcoach/core";
import { Trophy } from "lucide-react";
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
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {recommendations.map((rec, index) => {
        const isTop = index === 0;
        return (
          <li
            key={rec.card.id}
            className={cn(
              "relative overflow-hidden rounded-2xl border px-4 py-4 transition-shadow sm:px-5",
              isTop
                ? "border-primary/30 bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground shadow-sm",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      isTop
                        ? "bg-primary-foreground/15 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isTop ? <Trophy className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                    {rec.card.issuer}
                  </p>
                </div>
                <h3
                  className={cn(
                    "mt-1.5 font-display text-xl tracking-tight sm:text-2xl",
                    isTop ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {rec.card.name}
                </h3>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    isTop
                      ? "text-primary-foreground/80"
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
                    "font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
                    isTop ? "text-accent" : "text-primary",
                  )}
                >
                  {formatCentsPerDollar(rec.centsPerDollar)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em]",
                    isTop
                      ? "text-primary-foreground/65"
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
