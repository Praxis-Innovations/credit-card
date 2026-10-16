import type { CardExtraction } from "../extract/schema";
import { earnRate, welcomeBonus } from "./fixtures";

/** Minimal card shell so MC2 fixtures don't repeat identity fields. */
function shell(
  partial: Pick<CardExtraction, "card_name" | "earn_rates"> & Partial<CardExtraction>,
): CardExtraction {
  return {
    issuer: null,
    network: null,
    annual_fee: null,
    additional_card_fee: null,
    purchase_apr: null,
    cash_advance_apr: null,
    balance_transfer_apr: null,
    fx_fee_percent: null,
    min_personal_income: null,
    min_household_income: null,
    min_credit_limit: null,
    reward_currency: null,
    welcome_bonus: null,
    promotions: [],
    insurance_highlights: [],
    notes: null,
    ...partial,
  };
}

/** Tangerine-style: grocery category with an explicit MCC list in the terms. */
export const TANGERINE_MCC_PAGE = `Tangerine Money-Back Credit Card

Annual fee $0

Earn 2% back on your Grocery category. Eligible grocery purchases are those coded with merchant category codes 5411, 5422 and 5499. Warehouse clubs and gift cards are not eligible.

Earn 0.5% back on all other purchases.`;

const TANGERINE_URL = "https://www.tangerine.ca/creditcard";

export function tangerineMccExtraction(): CardExtraction {
  return shell({
    card_name: { value: "Tangerine Money-Back Credit Card", quote: "Tangerine Money-Back Credit Card" },
    issuer: { value: "Tangerine", quote: "Tangerine Money-Back Credit Card" },
    annual_fee: { value: 0, quote: "Annual fee $0" },
    earn_rates: [
      earnRate({
        category: "groceries",
        description: "Grocery category MCC 5411, 5422, 5499",
        rate: 2,
        unit: "percent_cashback",
        cap: null,
        quote:
          "Earn 2% back on your Grocery category. Eligible grocery purchases are those coded with merchant category codes 5411, 5422 and 5499. Warehouse clubs and gift cards are not eligible.",
        mccs: ["5411", "5422", "5499"],
        mcc_source: "terms",
        exclusions: ["warehouse clubs", "gift cards"],
        source_url: TANGERINE_URL,
      }),
      earnRate({
        category: "other",
        description: "all other purchases",
        rate: 0.5,
        unit: "percent_cashback",
        cap: null,
        quote: "Earn 0.5% back on all other purchases.",
        source_url: TANGERINE_URL,
      }),
    ],
  });
}

/** Amex Cobalt style: shared monthly cap across groceries + dining. */
export const COBALT_PAGE = `American Express Cobalt Card

Annual fee $12.99 per month

Earn 5 Membership Rewards points for every $1 at restaurants and stand-alone grocery stores in Canada, up to a combined maximum of $2,500 in net purchases posted to your account monthly on these categories. Once the maximum is reached, earn 1 point for every $1 thereafter. Superstores and warehouse clubs are not eligible grocery purchases.

Earn 1 point for every $1 on all other purchases.`;

const COBALT_URL = "https://www.americanexpress.com/ca/cobalt";
const COBALT_NAME = {
  card_name: { value: "American Express Cobalt Card", quote: "American Express Cobalt Card" },
  issuer: { value: "American Express", quote: "American Express Cobalt Card" },
  network: { value: "American Express" as const, quote: "American Express Cobalt Card" },
  annual_fee: { value: 12.99, quote: "Annual fee $12.99 per month" },
};

export function cobaltSharedCapExtraction(): CardExtraction {
  const sharedQuote =
    "Earn 5 Membership Rewards points for every $1 at restaurants and stand-alone grocery stores in Canada, up to a combined maximum of $2,500 in net purchases posted to your account monthly on these categories. Once the maximum is reached, earn 1 point for every $1 thereafter. Superstores and warehouse clubs are not eligible grocery purchases.";
  return shell({
    ...COBALT_NAME,
    reward_currency: {
      value: "Membership Rewards",
      quote: "Earn 5 Membership Rewards points for every $1",
    },
    earn_rates: [
      earnRate({
        category: "groceries",
        description: "stand-alone grocery stores",
        rate: 5,
        unit: "points_per_dollar",
        cap: "combined maximum of $2,500 monthly",
        quote: sharedQuote,
        mcc_source: "network_default",
        exclusions: ["Superstores", "warehouse clubs"],
        cap_amount: 2500,
        cap_period: "monthly",
        cap_group: "cobalt-5x",
        rate_after_cap: 1,
        source_url: COBALT_URL,
      }),
      earnRate({
        category: "dining",
        description: "restaurants",
        rate: 5,
        unit: "points_per_dollar",
        cap: "combined maximum of $2,500 monthly",
        quote: sharedQuote,
        mcc_source: "network_default",
        cap_amount: 2500,
        cap_period: "monthly",
        cap_group: "cobalt-5x",
        rate_after_cap: 1,
        source_url: COBALT_URL,
      }),
      earnRate({
        category: "other",
        description: "all other purchases",
        rate: 1,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 1 point for every $1 on all other purchases.",
        source_url: COBALT_URL,
      }),
    ],
  });
}

/** Momentum-style spend tier: higher grocery rate after $25,000 annual spend. */
export const MOMENTUM_PAGE = `Scotia Momentum Visa Infinite Card

Annual fee $120

Earn 4% cash back on groceries after you spend $25,000 on purchases in a calendar year. Before you reach $25,000, earn 1% cash back on groceries. Gift cards are excluded from grocery cash back.

Earn 1% cash back on all other purchases.`;

const MOMENTUM_URL = "https://www.scotiabank.com/momentum";

export function momentumTierExtraction(): CardExtraction {
  return shell({
    card_name: { value: "Scotia Momentum Visa Infinite Card", quote: "Scotia Momentum Visa Infinite Card" },
    network: { value: "Visa", quote: "Scotia Momentum Visa Infinite Card" },
    annual_fee: { value: 120, quote: "Annual fee $120" },
    reward_currency: { value: "cash back", quote: "Earn 4% cash back on groceries" },
    earn_rates: [
      earnRate({
        category: "groceries",
        description: "groceries after $25,000 annual spend",
        rate: 4,
        unit: "percent_cashback",
        cap: null,
        quote:
          "Earn 4% cash back on groceries after you spend $25,000 on purchases in a calendar year. Before you reach $25,000, earn 1% cash back on groceries. Gift cards are excluded from grocery cash back.",
        mcc_source: "network_default",
        exclusions: ["Gift cards"],
        tier_threshold: 25000,
        source_url: MOMENTUM_URL,
      }),
      earnRate({
        category: "other",
        description: "all other purchases",
        rate: 1,
        unit: "percent_cashback",
        cap: null,
        quote: "Earn 1% cash back on all other purchases.",
        source_url: MOMENTUM_URL,
      }),
    ],
  });
}

/** Welcome offer with start/end dates and new-cardholders-only. */
export const WELCOME_DATED_PAGE = `American Express Cobalt Card

Earn up to 30,000 Membership Rewards points as a welcome bonus. This offer is available to new American Express Cobalt Cardmembers only. Offer valid from January 1, 2026 to March 31, 2026.

Earn 10 points per $1 on groceries from March 1, 2026 to March 31, 2026.

Annual fee $12.99 per month
Earn 1 point for every $1 on purchases.`;

const WELCOME_DATED_URL = "https://www.americanexpress.com/ca/cobalt-offer";

export function welcomeDatedExtraction(): CardExtraction {
  return shell({
    ...COBALT_NAME,
    reward_currency: {
      value: "Membership Rewards",
      quote: "Earn up to 30,000 Membership Rewards points",
    },
    earn_rates: [
      earnRate({
        category: "other",
        description: "purchases",
        rate: 1,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 1 point for every $1 on purchases.",
        source_url: WELCOME_DATED_URL,
      }),
    ],
    welcome_bonus: {
      value: welcomeBonus({
        summary: "Up to 30,000 Membership Rewards points for new cardmembers",
        points: 30000,
        valid_from: "2026-01-01",
        valid_to: "2026-03-31",
        new_cardholders_only: true,
      }),
      quote:
        "Earn up to 30,000 Membership Rewards points as a welcome bonus. This offer is available to new American Express Cobalt Cardmembers only. Offer valid from January 1, 2026 to March 31, 2026.",
    },
    promotions: [
      {
        summary: "Spring grocery bonus 10x",
        rate: 10,
        points: null,
        categories: ["groceries"],
        valid_from: "2026-03-01",
        valid_to: "2026-03-31",
        quote: "Earn 10 points per $1 on groceries from March 1, 2026 to March 31, 2026.",
        source_url: WELCOME_DATED_URL,
      },
    ],
  });
}
