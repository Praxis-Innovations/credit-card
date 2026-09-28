import type {
  Category,
  FuelGrade,
  RecommendationItem,
  ValueAssumptions,
  ValueBreakdownItem,
} from "./api-types";

export function formatCad(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** "$100" for whole dollars, "$87.42" otherwise — for "back on your $100". */
export function formatAmountShort(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : formatCad(amount);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** ISO date ("2026-09-22" or full timestamp) → "Sep 22, 2026". */
export function formatVerifiedDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, y, m, d] = match;
  const month = MONTHS[Number(m) - 1];
  if (!month) return iso;
  return `${month} ${Number(d)}, ${y}`;
}

function formatCents(cents: number): string {
  const rounded = Math.round(cents * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, "")}¢`;
}

/**
 * Plain-language note under the breakdown, built only from the API's
 * assumptions and breakdown flags (nothing invented client-side).
 */
export function assumptionsNote(input: {
  assumptions?: ValueAssumptions;
  breakdown?: ValueBreakdownItem[];
  category: Category;
  fuelGrade?: FuelGrade | null;
}): string | null {
  const { assumptions, breakdown = [], category, fuelGrade } = input;
  const parts: string[] = [];

  if (assumptions?.litres && assumptions.cadPerLitre) {
    parts.push(
      `about ${Math.round(assumptions.litres)} L at $${assumptions.cadPerLitre.toFixed(2)}/L`,
    );
  }

  const valuations = Object.entries(assumptions?.pointValuations ?? {}).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  if (valuations.length > 0) {
    const distinct = new Set(valuations.map(([, v]) => v));
    if (distinct.size === 1) {
      const only = valuations[0]![1];
      parts.push(`points valued at ${formatCents(only)} each`);
    } else {
      parts.push(
        `points valued at ${valuations
          .map(([currency, v]) => `${formatCents(v)} (${currency})`)
          .join(", ")}`,
      );
    }
  }

  const sentences: string[] = [];
  if (parts.length === 1) sentences.push(`Estimate for ${parts[0]}.`);
  if (parts.length > 1) {
    sentences.push(`Estimate for ${parts[0]}, with ${parts.slice(1).join(", ")}.`);
  }

  if (category === "gas" && fuelGrade === "regular") {
    sentences.push("Assumes regular fuel; premium-only bonuses aren't counted.");
  }

  const promo = breakdown.find((line) => line.promotional);
  if (promo) {
    sentences.push(
      promo.promotionalEnds
        ? `Includes a promotional rate ending ${formatVerifiedDate(promo.promotionalEnds)}.`
        : "Includes a promotional rate with no published end date.",
    );
  }

  return sentences.length > 0 ? sentences.join(" ") : null;
}

/** Short subtitle for an "other card" row, from the API's own labels. */
export function otherCardSubtitle(rec: RecommendationItem): string {
  const earn = rec.valueBreakdown?.find((line) => line.kind === "card_earn");
  return earn?.label ?? rec.valueBreakdown?.[0]?.label ?? rec.reason;
}
