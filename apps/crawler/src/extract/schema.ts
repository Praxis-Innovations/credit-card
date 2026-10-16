/** Mirrors the catalog's spending categories (apps/api/src/domain/schema.ts CATEGORIES). */
export const CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "transit",
  "drugstore",
  "recurring_bills",
  "travel",
  "foreign_currency",
  "entertainment",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const EARN_UNITS = ["points_per_dollar", "miles_per_dollar", "percent_cashback"] as const;
export type EarnUnit = (typeof EARN_UNITS)[number];

export const NETWORKS = ["Visa", "Mastercard", "American Express"] as const;
export type Network = (typeof NETWORKS)[number];

/** How an earn rate's MCC list was obtained (matches catalog `mccSource`). */
const MCC_SOURCES = ["terms", "network_default"] as const;
type MccSource = (typeof MCC_SOURCES)[number];

/** Cap period when the terms state a numeric spend pool. */
const CAP_PERIODS = ["monthly", "annual", "statement"] as const;
type CapPeriod = (typeof CAP_PERIODS)[number];

/** Every extracted value carries the verbatim sentence it came from. */
export interface Quoted<T> {
  value: T;
  quote: string;
}

/**
 * One ongoing earn rate from the issuer terms.
 * MCC / cap / tier fields mirror catalog `RewardCategory` (snake_case here).
 * `source_url` is stamped from the crawled page URL after extraction.
 */
export interface EarnRate {
  category: Category;
  /** The page's own wording for what qualifies, e.g. "Sobeys, IGA, Safeway". */
  description: string;
  rate: number;
  unit: EarnUnit;
  /** Spend cap as written, e.g. "up to $50,000 annually"; null when none stated. */
  cap: string | null;
  quote: string;
  /** Four-digit MCC codes the terms list for this rate. Empty when none. */
  mccs: string[];
  /** Named merchants that qualify at this rate. Empty when none. */
  merchants: string[];
  /**
   * `terms` when the page lists MCCs and/or named merchants;
   * `network_default` when it only names a category (codes come from the network table later).
   */
  mcc_source: MccSource;
  /** Exclusions (warehouse clubs, gift cards, superstores, …). */
  exclusions: string[];
  /** Cap amount in CAD of spend when stated as a number. */
  cap_amount: number | null;
  /** Cap period when `cap_amount` is set. */
  cap_period: CapPeriod | null;
  /** Shared cap pool id when several categories share one cap (e.g. "cobalt-5x"). */
  cap_group: string | null;
  /** Earn rate after the bonus cap is exhausted. */
  rate_after_cap: number | null;
  /** Annual spend threshold before this tier rate unlocks. */
  tier_threshold: number | null;
  /** Inclusive ISO date (YYYY-MM-DD) when a dated rate starts. */
  valid_from: string | null;
  /** Inclusive ISO date when a dated rate ends so it can expire. */
  valid_to: string | null;
  /** Page URL this quote came from (filled by the crawler, not the model). */
  source_url: string | null;
}

export interface WelcomeBonus {
  summary: string;
  points: number | null;
  cashback_cad: number | null;
  /** Bonus earn rate / multiplier when the offer is stated that way instead of points. */
  rate: number | null;
  valid_from: string | null;
  valid_to: string | null;
  /** True when the page restricts the offer to new cardholders. */
  new_cardholders_only: boolean | null;
}

/** Limited-time public promotion from the product or offer page. */
interface PublicPromotion {
  summary: string;
  rate: number | null;
  points: number | null;
  categories: Category[];
  valid_from: string | null;
  valid_to: string | null;
  quote: string;
  source_url: string | null;
}

export interface CardExtraction {
  card_name: Quoted<string> | null;
  issuer: Quoted<string> | null;
  network: Quoted<Network> | null;
  annual_fee: Quoted<number> | null;
  additional_card_fee: Quoted<number> | null;
  purchase_apr: Quoted<number> | null;
  cash_advance_apr: Quoted<number> | null;
  balance_transfer_apr: Quoted<number> | null;
  fx_fee_percent: Quoted<number> | null;
  min_personal_income: Quoted<number> | null;
  min_household_income: Quoted<number> | null;
  min_credit_limit: Quoted<number> | null;
  reward_currency: Quoted<string> | null;
  earn_rates: EarnRate[];
  welcome_bonus: Quoted<WelcomeBonus> | null;
  /** Public, dated promotions (not the ongoing earn rates). */
  promotions: PublicPromotion[];
  insurance_highlights: Array<Quoted<string>>;
  /** Model's note on anything ambiguous. Not checked, never shown as data. */
  notes: string | null;
}

export const NUMBER_FIELDS = [
  "annual_fee",
  "additional_card_fee",
  "purchase_apr",
  "cash_advance_apr",
  "balance_transfer_apr",
  "fx_fee_percent",
  "min_personal_income",
  "min_household_income",
  "min_credit_limit",
] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];

export const STRING_FIELDS = ["card_name", "issuer", "network", "reward_currency"] as const;
export type StringField = (typeof STRING_FIELDS)[number];

// ---------------------------------------------------------------------------
// Runtime coercion of the model's tool input
// ---------------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) && v.trim() !== "" ? n : null;
  }
  return null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes") return true;
    if (s === "false" || s === "no") return false;
  }
  return null;
}

/** Accepts YYYY-MM-DD or common page date forms; returns ISO date or null. */
export function toIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function quotedOf<T>(v: unknown, read: (x: unknown) => T | null): Quoted<T> | null {
  if (!isObj(v) || typeof v.quote !== "string") return null;
  const value = read(v.value);
  return value === null ? null : { value, quote: v.quote };
}

const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

function oneOf<T extends string>(allowed: readonly T[]) {
  return (x: unknown): T | null => {
    if (typeof x !== "string") return null;
    const hit = allowed.find((a) => a.toLowerCase() === x.trim().toLowerCase());
    return hit ?? null;
  };
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t) out.push(t);
  }
  return out;
}

function mccList(v: unknown): string[] {
  const out: string[] = [];
  for (const raw of stringList(v)) {
    const digits = raw.replace(/\D/g, "");
    if (/^\d{4}$/.test(digits)) out.push(digits);
  }
  return [...new Set(out)];
}

function inferMccSource(explicit: MccSource | null, mccs: string[], merchants: string[]): MccSource {
  if (explicit) return explicit;
  return mccs.length > 0 || merchants.length > 0 ? "terms" : "network_default";
}

function coerceEarnRate(e: Record<string, unknown>): EarnRate | null {
  const category = oneOf(CATEGORIES)(e.category);
  const unit = oneOf(EARN_UNITS)(e.unit);
  const rate = toNumber(e.rate);
  if (!category || !unit || rate === null || typeof e.quote !== "string") return null;
  const mccs = mccList(e.mccs);
  const merchants = stringList(e.merchants);
  const mcc_source = inferMccSource(oneOf(MCC_SOURCES)(e.mcc_source), mccs, merchants);
  const cap_amount = toNumber(e.cap_amount);
  const cap_period = oneOf(CAP_PERIODS)(e.cap_period);
  return {
    category,
    unit,
    rate,
    description: typeof e.description === "string" ? e.description : "",
    cap: typeof e.cap === "string" && e.cap.trim() ? e.cap : null,
    quote: e.quote,
    mccs,
    merchants,
    mcc_source,
    exclusions: stringList(e.exclusions),
    cap_amount,
    cap_period: cap_amount !== null ? cap_period : null,
    cap_group: str(e.cap_group),
    rate_after_cap: toNumber(e.rate_after_cap),
    tier_threshold: toNumber(e.tier_threshold),
    valid_from: toIsoDate(e.valid_from),
    valid_to: toIsoDate(e.valid_to),
    source_url: null,
  };
}

function coercePromotion(p: unknown): PublicPromotion | null {
  if (!isObj(p) || typeof p.summary !== "string" || typeof p.quote !== "string") return null;
  const categories = (Array.isArray(p.categories) ? p.categories : [])
    .map((c) => oneOf(CATEGORIES)(c))
    .filter((c): c is Category => c !== null);
  return {
    summary: p.summary.trim(),
    rate: toNumber(p.rate),
    points: toNumber(p.points),
    categories,
    valid_from: toIsoDate(p.valid_from),
    valid_to: toIsoDate(p.valid_to),
    quote: p.quote,
    source_url: null,
  };
}

/** Turns raw tool input into a CardExtraction, dropping anything malformed rather than trusting it. */
export function coerceExtraction(input: unknown): CardExtraction {
  const o = isObj(input) ? input : {};
  const numberField = (k: NumberField) => quotedOf(o[k], toNumber);
  const earn: EarnRate[] = [];
  for (const e of Array.isArray(o.earn_rates) ? o.earn_rates : []) {
    if (!isObj(e)) continue;
    const rate = coerceEarnRate(e);
    if (rate) earn.push(rate);
  }
  const wb = quotedOf(o.welcome_bonus, (x) => {
    if (!isObj(x) || typeof x.summary !== "string") return null;
    return {
      summary: x.summary,
      points: toNumber(x.points),
      cashback_cad: toNumber(x.cashback_cad),
      rate: toNumber(x.rate),
      valid_from: toIsoDate(x.valid_from),
      valid_to: toIsoDate(x.valid_to),
      new_cardholders_only: toBool(x.new_cardholders_only),
    };
  });
  const promotions = (Array.isArray(o.promotions) ? o.promotions : [])
    .map(coercePromotion)
    .filter((p): p is PublicPromotion => p !== null);
  return {
    card_name: quotedOf(o.card_name, str),
    issuer: quotedOf(o.issuer, str),
    network: quotedOf(o.network, oneOf(NETWORKS)),
    annual_fee: numberField("annual_fee"),
    additional_card_fee: numberField("additional_card_fee"),
    purchase_apr: numberField("purchase_apr"),
    cash_advance_apr: numberField("cash_advance_apr"),
    balance_transfer_apr: numberField("balance_transfer_apr"),
    fx_fee_percent: numberField("fx_fee_percent"),
    min_personal_income: numberField("min_personal_income"),
    min_household_income: numberField("min_household_income"),
    min_credit_limit: numberField("min_credit_limit"),
    reward_currency: quotedOf(o.reward_currency, str),
    earn_rates: earn,
    welcome_bonus: wb,
    promotions,
    insurance_highlights: (Array.isArray(o.insurance_highlights) ? o.insurance_highlights : [])
      .map((x) => quotedOf(x, str))
      .filter((x): x is Quoted<string> => x !== null)
      .slice(0, 8),
    notes: str(o.notes),
  };
}

/** Attach the crawled page URL to every rate / promotion (model never invents URLs). */
export function stampSourceUrl(extraction: CardExtraction, pageUrl: string): CardExtraction {
  return {
    ...extraction,
    earn_rates: extraction.earn_rates.map((e) => ({ ...e, source_url: pageUrl })),
    promotions: extraction.promotions.map((p) => ({ ...p, source_url: pageUrl })),
  };
}

/**
 * Bump when `CardExtraction` gains fields that older cached / DB findings lack
 * (MCCs, promotions, source_url, …). Hash reuse must miss until re-extracted.
 */
export const EXTRACTION_SCHEMA_VERSION = 2;

/** Infer version from a stored finding: pre-MC2 rows omit `promotions` entirely. */
function extractionSchemaVersionOf(extraction: CardExtraction): number {
  const raw = extraction as { promotions?: unknown };
  if (raw.promotions === undefined) return 1;
  return EXTRACTION_SCHEMA_VERSION;
}

/** True when the page hash matches and the stored extraction is the current schema. */
export function canReuseCardExtraction(
  prev: { hash: string; extraction: CardExtraction; schemaVersion?: number } | null | undefined,
  pageHash: string,
): boolean {
  if (!prev || prev.hash !== pageHash) return false;
  const version = prev.schemaVersion ?? extractionSchemaVersionOf(prev.extraction);
  return version === EXTRACTION_SCHEMA_VERSION;
}
