"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { RankedCardRow } from "@/components/ranked-card-row";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  radioIndexForKey,
  rankCards,
} from "@/lib/try-it";
import type { Category, ExampleCardId } from "@/lib/try-it";

/** Placeholder card art (no issuer images): body and chip colour classes. */
const CARD_ART: Record<ExampleCardId, { body: string; chip: string }> = {
  gold: { body: "bg-card-gold", chip: "bg-card-gold-chip" },
  tri: { body: "bg-card-tri", chip: "bg-card-tri-chip" },
};

function CardArt({ id, label }: { id: ExampleCardId; label: string }) {
  const art = CARD_ART[id];
  return (
    <span
      role="img"
      aria-label={`${label} card`}
      className={`relative block h-7 w-11 shrink-0 rounded shadow-[0_6px_14px_-8px_var(--card-art-shadow)] md:h-[38px] md:w-[60px] ${art.body}`}
    >
      <span
        className={`absolute top-[11px] left-1 size-[7px] rounded-[2px] md:top-3.5 md:left-1.5 md:h-[9px] md:w-2.5 ${art.chip}`}
      />
    </span>
  );
}

export function TryItWidget({ className = "" }: { className?: string }) {
  const headingId = useId();
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ranked = rankCards(category);
  const winner = ranked[0];
  const selectedIndex = CATEGORIES.findIndex((c) => c.id === category);

  function onRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const next = radioIndexForKey(
      event.key,
      selectedIndex,
      CATEGORIES.length,
    );
    const nextCategory = next === null ? undefined : CATEGORIES[next];
    if (next === null || !nextCategory) return;
    event.preventDefault();
    setCategory(nextCategory.id);
    radioRefs.current[next]?.focus();
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col gap-3.5 rounded-[20px] border border-divider bg-surface p-4 shadow-[0_24px_48px_-36px_var(--hero-shadow)] md:gap-[18px] md:rounded-3xl md:p-6 md:shadow-[0_30px_60px_-40px_var(--hero-shadow)] ${className}`}
    >
      <div className="flex items-baseline justify-between">
        <h2
          id={headingId}
          className="font-display text-lg font-semibold text-foreground md:text-xl"
        >
          Try it
        </h2>
        <span className="text-[13px] text-muted md:text-sm">
          $100 purchase
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="What are you buying?"
        className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-divider p-1"
      >
        {CATEGORIES.map((c, index) => {
          const checked = c.id === category;
          return (
            <button
              key={c.id}
              ref={(el) => {
                radioRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setCategory(c.id)}
              onKeyDown={onRadioKeyDown}
              className={`h-11 cursor-pointer rounded-[9px] text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:h-10 ${
                checked
                  ? "bg-segment-thumb text-foreground shadow-[0_1px_3px_var(--segment-thumb-shadow)]"
                  : "bg-transparent text-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Top padding leaves room for the winner's pill, which overhangs its row. */}
      <ol
        aria-label="Cards, best first"
        className="flex flex-col gap-4 pt-1.5"
      >
        {ranked.map((card) => (
          <RankedCardRow
            key={card.id}
            dataCard={card.id}
            best={card.best}
            art={<CardArt id={card.id} label={card.fullName} />}
            name={card.name}
            detail={
              <>
                <span className="md:hidden">{card.whyCompact}</span>
                <span className="hidden md:inline">{card.why}</span>
              </>
            }
            amount={card.amount}
          />
        ))}
      </ol>

      <p className="sr-only" aria-live="polite">
        {winner
          ? `Tap ${winner.name} for ${category}: ${winner.amount} back.`
          : ""}
      </p>

      <p className="text-xs leading-[1.5] text-muted md:text-[13px]">
        Example with two real Canadian cards, points valued at 1¢. In the app,
        it uses your own cards.
      </p>
    </section>
  );
}
