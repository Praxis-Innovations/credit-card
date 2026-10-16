import { CATEGORIES, EARN_UNITS, NETWORKS } from "./schema";

const MCC_SOURCES = ["terms", "network_default"] as const;
const CAP_PERIODS = ["monthly", "annual", "statement"] as const;

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

