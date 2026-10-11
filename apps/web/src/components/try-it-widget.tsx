"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  radioIndexForKey,
  rankCards,
} from "@/lib/try-it";
import type { Category, ExampleCardId } from "@/lib/try-it";

/** Placeholder card art (no issuer images): body colour and chip colour. */
const CARD_ART: Record<ExampleCardId, { body: string; chip: string }> = {
  gold: { body: "#b8913f", chip: "#ecdcae" },
  tri: { body: "#5b4640", chip: "#d7c89b" },
};

function CardArt({ id, label }: { id: ExampleCardId; label: string }) {
  const art = CARD_ART[id];
  return (
    <span
      role="img"
      aria-label={`${label} card`}
      className="relative block h-9 w-14 shrink-0 rounded-[5px] shadow-[0_10px_24px_-14px_rgba(20,24,22,0.5)] md:h-[46px] md:w-[72px] md:rounded-md"
      style={{ background: art.body }}
    >
      <span
        className="absolute top-[13px] left-1.5 h-[9px] w-2.5 rounded-[3px] md:top-[17px] md:left-[7px] md:h-[11px] md:w-3"
        style={{ background: art.chip }}
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
      className={`flex flex-col gap-3.5 rounded-[20px] border border-divider bg-surface p-[18px] shadow-[0_24px_48px_-36px_var(--hero-shadow)] md:gap-5 md:rounded-3xl md:p-7 md:shadow-[0_30px_60px_-40px_var(--hero-shadow)] ${className}`}
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
                  ? "bg-segment-thumb text-foreground shadow-[0_1px_3px_rgba(20,24,22,0.15)]"
                  : "bg-transparent text-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <ol aria-label="Cards, best first" className="flex flex-col gap-2 md:gap-2.5">
        {ranked.map((card) => (
          <li
            key={card.id}
            data-card={card.id}
            className={`flex items-center gap-3 rounded-[14px] p-3 md:gap-3.5 md:p-3.5 ${
              card.best
                ? "border-2 border-primary bg-highlight"
                : "border border-divider bg-surface"
            }`}
          >
            <CardArt id={card.id} label={card.fullName} />
            <div className="min-w-0 grow">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm leading-[1.25] font-semibold text-foreground md:text-[15px]">
                  {card.name}
                </span>
                {card.best && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    Tap this
                  </span>
                )}
              </div>
              <div className="text-[13px] text-body md:text-sm">{card.why}</div>
            </div>
            <span
              className={`font-display text-[22px] font-semibold md:text-[26px] ${
                card.best ? "text-accent" : "text-foreground"
              }`}
            >
              {card.amount}
              <span className="sr-only"> back</span>
            </span>
          </li>
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
