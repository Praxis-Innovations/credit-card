"use client";

import {
  CATEGORY_LABELS,
  recommendCards,
  type Category,
} from "@cardcoach/core";
import { useMemo, useState } from "react";
import { CardSelector } from "@/components/card-selector";
import { CategoryPicker } from "@/components/category-picker";
import { RankedResults } from "@/components/ranked-results";
import { useOwnedCards } from "@/lib/use-owned-cards";

export function Optimizer() {
  const { ownedIds, toggle, clear, hydrated } = useOwnedCards();
  const [category, setCategory] = useState<Category | null>("groceries");

  const recommendations = useMemo(() => {
    if (!category || ownedIds.length === 0) return [];
    return recommendCards({ ownedCardIds: ownedIds, category });
  }, [ownedIds, category]);

  const emptyHint =
    ownedIds.length === 0
      ? "Pick the cards in your wallet to see which one wins for each category."
      : category
        ? "No matching cards — try another category."
        : "Tap a spending category to rank your cards.";

  return (
    <section id="optimizer" className="scroll-mt-24">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          The tool
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Which card should you tap?
        </h2>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Select your wallet, pick a category, and we rank cents-back-per-dollar
          — earn rate × point value. No bank login. No guesswork.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
        <CardSelector
          ownedIds={ownedIds}
          onToggle={toggle}
          onClear={clear}
          hydrated={hydrated}
        />

        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur sm:p-5">
            <h3 className="font-display text-xl tracking-tight text-foreground">
              Spending category
            </h3>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              {category
                ? `Ranking for ${CATEGORY_LABELS[category].toLowerCase()}`
                : "Choose where you’re about to spend"}
            </p>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h3 className="font-display text-xl tracking-tight text-foreground">
                Best card to use
              </h3>
              {recommendations.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {recommendations.length} ranked
                </p>
              )}
            </div>
            <RankedResults
              recommendations={recommendations}
              emptyHint={emptyHint}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
