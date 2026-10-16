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
export const MCC_SOURCES = ["terms", "network_default"] as const;
export type MccSource = (typeof MCC_SOURCES)[number];

/** Cap period when the terms state a numeric spend pool. */
export const CAP_PERIODS = ["monthly", "annual", "statement"] as const;
export type CapPeriod = (typeof CAP_PERIODS)[number];

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
export interface PublicPromotion {
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
// JSON schema for the Claude tool
// ---------------------------------------------------------------------------

type JsonSchema = Record<string, unknown>;

const QUOTE: JsonSchema = {
  type: "string",
  description:
    "Exact text copied character-for-character from the page that states this value. One contiguous passage, no ellipses, no paraphrase.",
};

function quoted(value: JsonSchema, description: string): JsonSchema {
  return {
    description: `${description} Null if the page does not state it.`,
    anyOf: [
      {
        type: "object",
        properties: { value, quote: QUOTE },
        required: ["value", "quote"],
        additionalProperties: false,
      },
      { type: "null" },
    ],
  };
}

const num = (description: string): JsonSchema => quoted({ type: "number" }, description);

const ISO_DATE: JsonSchema = {
  type: ["string", "null"],
  description: "Inclusive calendar date as YYYY-MM-DD, or null if the page does not state it.",
};

const MCC_LIST: JsonSchema = {
  type: "array",
  description: "Four-digit merchant category codes listed for this rate. Empty when the page lists none.",
  items: { type: "string", pattern: "^\\d{4}$" },
};

const STRING_LIST: JsonSchema = {
  type: "array",
  items: { type: "string" },
};

export const CARD_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "card_name", "issuer", "network", "annual_fee", "additional_card_fee", "purchase_apr",
    "cash_advance_apr", "balance_transfer_apr", "fx_fee_percent", "min_personal_income",
    "min_household_income", "min_credit_limit", "reward_currency", "earn_rates", "welcome_bonus",
    "promotions", "insurance_highlights", "notes",
  ],
  properties: {
    card_name: quoted({ type: "string" }, "Full product name as shown on the page."),
    issuer: quoted({ type: "string" }, "Issuing bank as named on the page."),
    network: quoted({ type: "string", enum: [...NETWORKS] }, "Card network."),
    annual_fee: num("Primary cardholder annual fee in CAD (0 if the page says no annual fee)."),
    additional_card_fee: num("Annual fee per supplementary/additional card in CAD."),
    purchase_apr: num("Standard annual interest rate on purchases, in percent."),
    cash_advance_apr: num("Standard annual interest rate on cash advances, in percent."),
    balance_transfer_apr: num("Standard (non-promotional) balance transfer rate, in percent."),
    fx_fee_percent: num("Foreign transaction / currency conversion fee in percent (0 if the page says none)."),
    min_personal_income: num("Minimum annual personal income in CAD."),
    min_household_income: num("Minimum annual household income in CAD."),
    min_credit_limit: num("Minimum credit limit in CAD."),
    reward_currency: quoted({ type: "string" }, 'What the card earns, e.g. "Scene+ points", "cash back". Null for no-rewards cards.'),
    earn_rates: {
      type: "array",
      description:
        "Every ongoing (non-promotional) earn rate, including MCC lists, named merchants, exclusions, caps, shared-cap groups, rate after cap, and spend tiers. Empty for no-rewards cards. The base rate on everything else uses category 'other'.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "category", "description", "rate", "unit", "cap", "quote",
          "mccs", "merchants", "mcc_source", "exclusions",
          "cap_amount", "cap_period", "cap_group", "rate_after_cap",
          "tier_threshold", "valid_from", "valid_to",
        ],
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          description: { type: "string", description: "The page's wording for what qualifies." },
          rate: { type: "number", description: "Points/miles per $1, or percent for cash back (4% -> 4)." },
          unit: { type: "string", enum: [...EARN_UNITS] },
          cap: { type: ["string", "null"], description: "Spend cap exactly as written, or null." },
          quote: QUOTE,
          mccs: MCC_LIST,
          merchants: {
            ...STRING_LIST,
            description: "Named merchants that earn this rate (e.g. Sobeys, Safeway). Empty when none named.",
          },
          mcc_source: {
            type: "string",
            enum: [...MCC_SOURCES],
            description:
              "terms when the page lists MCC codes and/or named merchants; network_default when it only names a category.",
          },
          exclusions: {
            ...STRING_LIST,
            description:
              "Merchants or product types excluded from this rate (warehouse clubs, gift cards, superstores, …).",
          },
          cap_amount: {
            type: ["number", "null"],
            description: "Spend cap amount in CAD when stated as a number (e.g. 2500 for $2,500).",
          },
          cap_period: {
            anyOf: [
              { type: "string", enum: [...CAP_PERIODS] },
              { type: "null" },
            ],
            description: "monthly, annual or statement when cap_amount is set; otherwise null.",
          },
          cap_group: {
            type: ["string", "null"],
            description:
              "Stable id shared by rates that draw from one combined cap (e.g. cobalt-5x for groceries+dining). Null when the cap is not shared.",
          },
          rate_after_cap: {
            type: ["number", "null"],
            description: "Earn rate after the bonus cap is reached. Null when not stated.",
          },
          tier_threshold: {
            type: ["number", "null"],
            description: "Annual spend in CAD required before this tier rate applies. Null when not a tier.",
          },
          valid_from: ISO_DATE,
          valid_to: ISO_DATE,
        },
      },
    },
    welcome_bonus: quoted(
      {
        type: "object",
        additionalProperties: false,
        required: [
          "summary", "points", "cashback_cad", "rate",
          "valid_from", "valid_to", "new_cardholders_only",
        ],
        properties: {
          summary: { type: "string", description: "One-line summary of the current welcome offer." },
          points: { type: ["number", "null"], description: "Total bonus points/miles, if stated." },
          cashback_cad: { type: ["number", "null"], description: "Bonus cash back in CAD, if stated." },
          rate: {
            type: ["number", "null"],
            description: "Bonus earn rate/multiplier when the offer is stated that way instead of points.",
          },
          valid_from: ISO_DATE,
          valid_to: ISO_DATE,
          new_cardholders_only: {
            type: ["boolean", "null"],
            description: "True when the page says new cardholders only; false when it says otherwise; null if unstated.",
          },
        },
      },
      "Current welcome / sign-up offer, including dates and new-cardholder restriction when stated.",
    ),
    promotions: {
      type: "array",
      description:
        "Public, limited-time promotions from the page (offer banners, seasonal bonuses). Empty when none. Do not duplicate the ongoing earn_rates or the welcome_bonus.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "rate", "points", "categories", "valid_from", "valid_to", "quote"],
        properties: {
          summary: { type: "string" },
          rate: { type: ["number", "null"] },
          points: { type: ["number", "null"] },
          categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
          valid_from: ISO_DATE,
          valid_to: ISO_DATE,
          quote: QUOTE,
        },
      },
    },
    insurance_highlights: {
      type: "array",
      description: "Up to 8 insurance coverages the card includes (e.g. travel medical, rental car).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["value", "quote"],
        properties: { value: { type: "string" }, quote: QUOTE },
      },
    },
    notes: { type: ["string", "null"], description: "Anything ambiguous on the page. Null if nothing." },
  },
};

export const LINKS_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      description: "One entry per individual personal credit card product page.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["card_name", "url"],
        properties: {
          card_name: { type: "string" },
          url: { type: "string", description: "Copied exactly from the provided link list." },
        },
      },
    },
  },
};

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
