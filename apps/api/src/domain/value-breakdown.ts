import { ASSUMED_CAD_PER_LITRE } from "./recommend-merchant";
import type {
  PointCurrency,
  ValueComponent,
  ValueComponentKind,
} from "./schema";

/** One dollar-denominated line of a recommendation's estimated reward. */
export interface ValueBreakdownItem {
  label: string;
  kind: ValueComponentKind;
  /** Whole-cent CAD value; items sum exactly to the breakdown total. */
  amountCad: number;
  partnershipId?: string;
  /** Points earned on this purchase, for point-denominated items. */
  points?: number;
  pointCurrency?: PointCurrency;
  centsPerPoint?: number;
  promotional?: boolean;
  /** Published end date for promotional items, or null when none is published. */
  promotionalEnds?: string | null;
}

export interface ValueAssumptions {
  /** Pump price used to convert per-litre benefits; null when none applied. */
  cadPerLitre: number | null;
  /** amountCad ÷ cadPerLitre; null when no per-litre benefit applied. */
  litres: number | null;
  /** ¢/pt for every point currency valued in the breakdown. */
  pointValuations: Partial<Record<PointCurrency, number>>;
}

export interface ValueBreakdown {
  items: ValueBreakdownItem[];
  /** Sum of `items[].amountCad`, i.e. amountCad × centsPerDollar ÷ 100 rounded to the cent. */
  totalCad: number;
  assumptions: ValueAssumptions;
}

const PER_LITRE_KINDS: ReadonlySet<ValueComponentKind> = new Set([
  "cents_per_litre_instant",
  "cents_per_litre_rewards",
  "points_per_litre",
]);

/** Fractions closer than this are float noise and treated as ties. */
const FRACTION_EPSILON = 1e-9;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Round each exact cent amount to a whole cent so the parts sum to the
 * rounded total (largest-remainder method; ties go to the larger part).
 */
export function allocateCents(exactCents: number[]): number[] {
  const total = Math.round(exactCents.reduce((s, c) => s + c, 0));
  const cents = exactCents.map((c) => Math.floor(c + FRACTION_EPSILON));
  let remainder = total - cents.reduce((s, c) => s + c, 0);
  const byFraction = exactCents
    .map((c, i) => ({ i, exact: c, fraction: c - cents[i]! }))
    .sort((a, b) => {
      const diff = b.fraction - a.fraction;
      if (Math.abs(diff) > FRACTION_EPSILON) return diff;
      return b.exact - a.exact || a.i - b.i;
    });
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    cents[i]! += 1;
    remainder -= 1;
  }
  return cents;
}

/**
 * Scale a recommendation's per-dollar value components to a purchase amount.
 */
export function buildValueBreakdown(
  components: ValueComponent[],
  amountCad: number,
  cadPerLitre = ASSUMED_CAD_PER_LITRE,
): ValueBreakdown {
  const litres = cadPerLitre > 0 ? amountCad / cadPerLitre : 0;
  const cents = allocateCents(
    components.map((c) => amountCad * c.centsPerDollar),
  );
  const pointValuations: Partial<Record<PointCurrency, number>> = {};
  let usesLitres = false;

  const items = components.map((c, i): ValueBreakdownItem => {
    const item: ValueBreakdownItem = {
      label: c.label,
      kind: c.kind,
      amountCad: cents[i]! / 100,
    };
    if (c.partnershipId) item.partnershipId = c.partnershipId;
    if (PER_LITRE_KINDS.has(c.kind)) usesLitres = true;

    if (c.valuation) {
      pointValuations[c.valuation.currency] = c.valuation.centsPerPoint;
      let points: number | undefined;
      if (c.kind === "card_earn") points = (c.earnRate ?? 0) * amountCad;
      else if (c.kind === "points_per_dollar" && c.benefit)
        points = c.benefit.amount * amountCad;
      else if (c.kind === "points_per_litre" && c.benefit)
        points = c.benefit.amount * litres;
      if (points !== undefined) item.points = round2(points);
      item.pointCurrency = c.valuation.currency;
      item.centsPerPoint = c.valuation.centsPerPoint;
    }

    if (c.benefit?.promotional) {
      item.promotional = true;
      item.promotionalEnds = c.benefit.promotionalEnds ?? null;
    }
    return item;
  });

  return {
    items,
    totalCad: cents.reduce((s, c) => s + c, 0) / 100,
    assumptions: {
      cadPerLitre: usesLitres ? cadPerLitre : null,
      litres: usesLitres ? round2(litres) : null,
      pointValuations,
    },
  };
}
