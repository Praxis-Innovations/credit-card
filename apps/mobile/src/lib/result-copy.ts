import {
  CATEGORY_LABELS,
  type Category,
  type LoyaltyProgram,
  type RecommendationItem,
  type ValueBreakdownItem,
} from "./api-types";
import { programForCurrency } from "./programs";

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

/** 4 → "4", 1.5 → "1.5", 1234.56 → "1,234.56". */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const [whole, fraction] = String(Math.abs(rounded)).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${rounded < 0 ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

function formatCents(cents: number): string {
  return `${formatNumber(cents)}¢`;
}

/** "gas", "groceries", "everything else" — for "Earn rate on gas". */
export function categoryPhrase(category: Category): string {
  return CATEGORY_LABELS[category].toLowerCase();
}

function isCashBack(rec: RecommendationItem): boolean {
  return rec.card.pointCurrency === "cashback";
}

/** The card's own category-earn line from the API breakdown, if present. */
function earnLine(rec: RecommendationItem): ValueBreakdownItem | undefined {
  return rec.valueBreakdown?.find((line) => line.kind === "card_earn");
}

function programName(rec: RecommendationItem, programs: LoyaltyProgram[]): string {
  const currency = earnLine(rec)?.pointCurrency ?? rec.card.pointCurrency;
  return programForCurrency(currency, programs).name;
}

/** "4× Triangle Rewards on gas" / "3% cash back on gas". */
export function earnSummary(
  rec: RecommendationItem,
  category: Category,
  programs: LoyaltyProgram[],
): string {
  const rate = formatNumber(rec.earnRate);
  const cap = rec.capExhausted ? " (bonus cap reached)" : "";
  if (isCashBack(rec)) return `${rate}% cash back on ${categoryPhrase(category)}${cap}`;
  return `${rate}× ${programName(rec, programs)} on ${categoryPhrase(category)}${cap}`;
}

export interface BreakdownRow {
  label: string;
  value: string;
  /** The "Total back" row (desktop). */
  total?: boolean;
}

/**
 * How the best card earns: category earn rate, points earned and point value,
 * from the API's card-earn line (rate, points, ¢/pt) and estimatedRewardCad.
 * `detailed` is the desktop table: it adds the category and a total row.
 */
export function breakdownRows(
  rec: RecommendationItem,
  input: {
    category: Category;
    amountCad: number;
    programs: LoyaltyProgram[];
    detailed?: boolean;
  },
): BreakdownRow[] {
  const { category, amountCad, programs, detailed } = input;
  const phrase = categoryPhrase(category);
  const line = earnLine(rec);
  const rate = formatNumber(rec.earnRate);
  const cap = rec.capExhausted ? " (bonus cap reached)" : "";
  const rows: BreakdownRow[] = [];

  if (detailed) rows.push({ label: "Spending category", value: CATEGORY_LABELS[category] });

  if (isCashBack(rec)) {
    rows.push({ label: `Cash back on ${phrase}${cap}`, value: `${rate}%` });
  } else {
    const program = programName(rec, programs);
    const points = line?.points ?? rec.earnRate * amountCad;
    const centsPerPoint = line?.centsPerPoint ?? rec.pointValue;
    rows.push(
      {
        label: `Earn rate on ${phrase}${cap}`,
        value: detailed ? `${rate} ${program} per $1` : `${rate} pts per $1`,
      },
      detailed
        ? { label: `Points earned on ${formatAmountShort(amountCad)}`, value: formatNumber(points) }
        : { label: "Points earned", value: `${formatNumber(points)} ${program}` },
      { label: "Point value", value: `${formatCents(centsPerPoint)} each` },
    );
  }

  if (detailed) {
    rows.push({ label: "Total back", value: formatCad(rec.estimatedRewardCad), total: true });
  }
  return rows;
}

/** Note under the breakdown: where the estimate comes from and when rates were checked. */
export function estimateNote(
  rec: RecommendationItem,
  category: Category,
  detailed = false,
): string {
  const verified = `Rates verified ${formatVerifiedDate(rec.card.lastVerified)}.`;
  const source = detailed
    ? "Based on each card's published rate for the purchase category."
    : category === "other"
      ? "Estimate from the card's base earn rate."
      : `Estimate from the card's ${categoryPhrase(category)} category rate.`;
  const promo = earnLine(rec);
  const promoNote = promo?.promotional
    ? promo.promotionalEnds
      ? ` Includes a promotional rate ending ${formatVerifiedDate(promo.promotionalEnds)}.`
      : " Includes a promotional rate with no published end date."
    : "";
  return `${source} ${verified}${promoNote}`;
}
