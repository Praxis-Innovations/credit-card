"use client";

import { useId, useState } from "react";
import { RankedCardRow } from "@/components/ranked-card-row";
import { dollarsBack, formatDollars } from "@/lib/catalog";

/** A catalog card as the calculator needs it, precomputed on the server. */
export type CalculatorCard = {
  id: string;
  name: string;
  issuer: string;
  /** Position in the category ranking (0 = best); orders the results. */
  rank: number;
  centsPerDollar: number;
  /** e.g. "5× Amex MR at 2.4¢/pt". */
  detail: string;
};

export const MAX_AMOUNT = 100_000;

/** Purchase amount in dollars, or null when the input isn't a usable amount. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  return amount;
}

/** Picked cards (deduplicated, blanks skipped) in ranking order. */
export function rankPicks(
  cards: readonly CalculatorCard[],
  picks: readonly string[],
): CalculatorCard[] {
  const ids = new Set(picks.filter(Boolean));
  return cards.filter((card) => ids.has(card.id)).sort((a, b) => a.rank - b.rank);
}

const FIELD =
  "h-11 w-full rounded-[10px] border border-divider bg-surface px-3 text-[15px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const LABEL = "text-[13px] font-semibold text-foreground md:text-sm";

export function CardCalculator({
  categoryNoun,
  cards,
  defaultPicks,
  defaultAmount,
  maxPicks,
  className = "",
}: {
  /** "gas", "groceries", "restaurants". */
  categoryNoun: string;
  cards: readonly CalculatorCard[];
  defaultPicks: readonly string[];
  defaultAmount: number;
  maxPicks: number;
  className?: string;
}) {
  const id = useId();
  const [picks, setPicks] = useState<string[]>(() =>
    Array.from({ length: maxPicks }, (_, i) => defaultPicks[i] ?? ""),
  );
  const [amountInput, setAmountInput] = useState(String(defaultAmount));
  const amount = parseAmount(amountInput);
  const ranked = rankPicks(cards, picks);
  const winner = ranked[0];

  const issuers = [...new Set(cards.map((card) => card.issuer))].sort((a, b) =>
    a.localeCompare(b),
  );

  function setPick(index: number, value: string) {
    setPicks((current) => current.map((pick, i) => (i === index ? value : pick)));
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-divider bg-surface p-4 shadow-[0_24px_48px_-36px_var(--hero-shadow)] md:gap-[18px] md:rounded-3xl md:p-6 md:shadow-[0_30px_60px_-40px_var(--hero-shadow)] ${className}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={`${id}-heading`}
          className="font-display text-lg font-semibold text-foreground md:text-xl"
        >
          Try it
        </h2>
        <span className="text-[13px] text-muted md:text-sm">
          Up to {maxPicks} cards
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-amount`} className={LABEL}>
          Purchase amount
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted"
          >
            $
          </span>
          <input
            id={`${id}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            aria-invalid={amount === null}
            aria-describedby={amount === null ? `${id}-amount-error` : undefined}
            className={`${FIELD} pl-7`}
          />
        </div>
        {amount === null && (
          <p id={`${id}-amount-error`} className="text-[13px] text-foreground">
            Enter a dollar amount up to ${MAX_AMOUNT.toLocaleString("en-CA")}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {picks.map((pick, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${id}-card-${index}`} className={LABEL}>
              Card {index + 1}
            </label>
            <select
              id={`${id}-card-${index}`}
              value={pick}
              onChange={(event) => setPick(index, event.target.value)}
              className={`${FIELD} min-w-0 cursor-pointer truncate`}
            >
              <option value="">No card</option>
              {issuers.map((issuer) => (
                <optgroup key={issuer} label={issuer}>
                  {cards
                    .filter((card) => card.issuer === issuer)
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
      </div>

      {ranked.length > 0 ? (
        <ol aria-label="Cards, best first" className="flex flex-col gap-4 pt-1.5">
          {ranked.map((card, index) => (
            <RankedCardRow
              key={card.id}
              dataCard={card.id}
              best={index === 0 && card.centsPerDollar > 0}
              name={card.name}
              detail={card.detail}
              amount={
                amount === null
                  ? "–"
                  : formatDollars(dollarsBack(amount, card.centsPerDollar))
              }
            />
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-divider p-4 text-sm text-muted">
          Pick a card to see what it earns on {categoryNoun}.
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {winner && amount !== null
          ? `Tap ${winner.name} for ${categoryNoun}: ${formatDollars(
              dollarsBack(amount, winner.centsPerDollar),
            )} back on ${formatDollars(amount)}.`
          : ""}
      </p>

      <p className="text-xs leading-[1.5] text-muted md:text-[13px]">
        Dollars back = amount × earn rate × point value.{" "}
        <a
          href="#point-values"
          className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          See the point values we use
        </a>
        .
      </p>
    </section>
  );
}
