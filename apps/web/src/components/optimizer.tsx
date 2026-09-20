"use client";

import {
  CATEGORY_LABELS,
  recommendCards,
  type Category,
} from "@northtap/core";
import { useMemo, useState } from "react";
import { CardSelector } from "@/components/card-selector";
import { CategoryPicker } from "@/components/category-picker";
import { RankedResults } from "@/components/ranked-results";
import { Button } from "@/components/ui/button";

export function Optimizer() {
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [category, setCategory] = useState<Category | null>("groceries");

  function toggle(id: string) {
    setOwnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clear() {
    setOwnedIds([]);
  }

  const recommendations = useMemo(() => {
    if (!category || ownedIds.length === 0) return [];
    return recommendCards({ ownedCardIds: ownedIds, category });
  }, [ownedIds, category]);

  const emptyHint =
    ownedIds.length === 0
      ? "Check a few cards you carry — picks stay for this visit only."
      : category
        ? "No matching cards — try another category."
        : "Tap a spending category to rank your cards.";

  return (
    <section id="optimizer" className="scroll-mt-24">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Try it free
        </p>
        <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Which card should you tap?
        </h2>
        <p className="text-base text-muted-foreground sm:text-lg">
          A quick session tool — pick cards from the list, choose a category,
          see cents-back-per-dollar. Nothing is saved. The full app keeps your
          wallet across visits.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
        <CardSelector
          ownedIds={ownedIds}
          onToggle={toggle}
          onClear={clear}
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

          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-5 sm:px-5">
            <p className="font-display text-lg tracking-tight text-foreground">
              Want this to remember your cards?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The NorthTap app saves your wallet and ranks on the go — iOS,
              Android, and web.
            </p>
            <Button
              className="mt-4"
              size="lg"
              disabled
              aria-disabled="true"
              title="App coming soon"
            >
              Get the app to save your cards
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
    </section>
  );
}
