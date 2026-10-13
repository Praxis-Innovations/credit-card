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

/** Every extracted value carries the verbatim sentence it came from. */
export interface Quoted<T> {
  value: T;
  quote: string;
}

export interface EarnRate {
  category: Category;
  /** The page's own wording for what qualifies, e.g. "Sobeys, IGA, Safeway". */
  description: string;
  rate: number;
  unit: EarnUnit;
  /** Spend cap as written, e.g. "up to $50,000 annually"; null when none stated. */
  cap: string | null;
  quote: string;
}

export interface WelcomeBonus {
  summary: string;
  points: number | null;
  cashback_cad: number | null;
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

export const CARD_TOOL_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "card_name", "issuer", "network", "annual_fee", "additional_card_fee", "purchase_apr",
    "cash_advance_apr", "balance_transfer_apr", "fx_fee_percent", "min_personal_income",
    "min_household_income", "min_credit_limit", "reward_currency", "earn_rates", "welcome_bonus",
    "insurance_highlights", "notes",
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
        "Every ongoing (non-promotional) earn rate. Empty for no-rewards cards. The base rate on everything else uses category 'other'.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "description", "rate", "unit", "cap", "quote"],
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          description: { type: "string", description: "The page's wording for what qualifies." },
          rate: { type: "number", description: "Points/miles per $1, or percent for cash back (4% -> 4)." },
          unit: { type: "string", enum: [...EARN_UNITS] },
          cap: { type: ["string", "null"], description: "Spend cap exactly as written, or null." },
          quote: QUOTE,
        },
      },
    },
    welcome_bonus: quoted(
      {
        type: "object",
        additionalProperties: false,
        required: ["summary", "points", "cashback_cad"],
        properties: {
          summary: { type: "string", description: "One-line summary of the current welcome offer." },
          points: { type: ["number", "null"], description: "Total bonus points/miles, if stated." },
          cashback_cad: { type: ["number", "null"], description: "Bonus cash back in CAD, if stated." },
        },
      },
      "Current welcome / sign-up offer.",
    ),
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

/** Turns raw tool input into a CardExtraction, dropping anything malformed rather than trusting it. */
export function coerceExtraction(input: unknown): CardExtraction {
  const o = isObj(input) ? input : {};
  const numberField = (k: NumberField) => quotedOf(o[k], toNumber);
  const earn: EarnRate[] = [];
  for (const e of Array.isArray(o.earn_rates) ? o.earn_rates : []) {
    if (!isObj(e)) continue;
    const category = oneOf(CATEGORIES)(e.category);
    const unit = oneOf(EARN_UNITS)(e.unit);
    const rate = toNumber(e.rate);
    if (!category || !unit || rate === null || typeof e.quote !== "string") continue;
    earn.push({
      category,
      unit,
      rate,
      description: typeof e.description === "string" ? e.description : "",
      cap: typeof e.cap === "string" && e.cap.trim() ? e.cap : null,
      quote: e.quote,
    });
  }
  const wb = quotedOf(o.welcome_bonus, (x) => {
    if (!isObj(x) || typeof x.summary !== "string") return null;
    return { summary: x.summary, points: toNumber(x.points), cashback_cad: toNumber(x.cashback_cad) };
  });
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
    insurance_highlights: (Array.isArray(o.insurance_highlights) ? o.insurance_highlights : [])
      .map((x) => quotedOf(x, str))
      .filter((x): x is Quoted<string> => x !== null)
      .slice(0, 8),
    notes: str(o.notes),
  };
}
