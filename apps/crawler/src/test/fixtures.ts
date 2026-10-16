import type { CardExtraction, EarnRate, WelcomeBonus } from "../extract/schema";
import type { CatalogCard } from "../types";

/** Defaults for earn-rate MCC fields so older fixtures stay concise. */
export function earnRate(partial: Omit<EarnRate, "mccs" | "merchants" | "mcc_source" | "exclusions" | "cap_amount" | "cap_period" | "cap_group" | "rate_after_cap" | "tier_threshold" | "valid_from" | "valid_to" | "source_url"> & Partial<EarnRate>): EarnRate {
  const mccs = partial.mccs ?? [];
  const merchants = partial.merchants ?? [];
  return {
    description: partial.description,
    category: partial.category,
    rate: partial.rate,
    unit: partial.unit,
    cap: partial.cap,
    quote: partial.quote,
    mccs,
    merchants,
    mcc_source:
      partial.mcc_source ??
      (mccs.length > 0 || merchants.length > 0 ? "terms" : "network_default"),
    exclusions: partial.exclusions ?? [],
    cap_amount: partial.cap_amount ?? null,
    cap_period: partial.cap_period ?? null,
    cap_group: partial.cap_group ?? null,
    rate_after_cap: partial.rate_after_cap ?? null,
    tier_threshold: partial.tier_threshold ?? null,
    valid_from: partial.valid_from ?? null,
    valid_to: partial.valid_to ?? null,
    source_url: partial.source_url ?? null,
  };
}

export function welcomeBonus(
  partial: Pick<WelcomeBonus, "summary"> & Partial<WelcomeBonus>,
): WelcomeBonus {
  return {
    summary: partial.summary,
    points: partial.points ?? null,
    cashback_cad: partial.cashback_cad ?? null,
    rate: partial.rate ?? null,
    valid_from: partial.valid_from ?? null,
    valid_to: partial.valid_to ?? null,
    new_cardholders_only: partial.new_cardholders_only ?? null,
  };
}

/** Cleaned text in the shape our cleaner produces for a Scotiabank card page. */
export const GOLD_PAGE_TEXT = `Scotiabank Gold American Express® Card

Earn up to 50,000 bonus Scene+ points in your first year.

Your card at a glance

Annual fee

$120
/year

Purchase interest rate

21.99%

Cash advance rate

22.99%

You can apply if:
You have a minimum personal income of $12,000 per year.

- Earn 6 Scene+ points2 on every $1 CAD you spend in Canada at Sobeys, Safeway, FreshCo and more.
- Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.
- Earn 1 Scene+ point for every $1 on all other eligible purchases.

No foreign transaction fees5,Δ

Travel Emergency Medical Insurance | up to $1,000,000`;

export function goldExtraction(overrides: Partial<CardExtraction> = {}): CardExtraction {
  return {
    card_name: { value: "Scotiabank Gold American Express Card", quote: "Scotiabank Gold American Express® Card" },
    issuer: { value: "Scotiabank", quote: "Scotiabank Gold American Express® Card" },
    network: { value: "American Express", quote: "Scotiabank Gold American Express® Card" },
    annual_fee: { value: 120, quote: "Annual fee\n$120\n/year" },
    additional_card_fee: null,
    purchase_apr: { value: 21.99, quote: "Purchase interest rate 21.99%" },
    cash_advance_apr: { value: 22.99, quote: "Cash advance rate\n\n22.99%" },
    balance_transfer_apr: null,
    fx_fee_percent: { value: 0, quote: "No foreign transaction fees" },
    min_personal_income: { value: 12000, quote: "You have a minimum personal income of $12,000 per year." },
    min_household_income: null,
    min_credit_limit: null,
    reward_currency: { value: "Scene+ points", quote: "Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment." },
    earn_rates: [
      earnRate({
        category: "groceries",
        description: "Sobeys, Safeway, FreshCo and more",
        rate: 6,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 6 Scene+ points2 on every $1 CAD you spend in Canada at Sobeys, Safeway, FreshCo and more.",
        merchants: ["Sobeys", "Safeway", "FreshCo"],
        mcc_source: "terms",
        source_url: "https://www.scotiabank.com/gold-amex",
      }),
      earnRate({
        category: "dining",
        description: "eligible dining and entertainment",
        rate: 5,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.",
        source_url: "https://www.scotiabank.com/gold-amex",
      }),
      earnRate({
        category: "other",
        description: "all other eligible purchases",
        rate: 1,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 1 Scene+ point for every $1 on all other eligible purchases.",
        source_url: "https://www.scotiabank.com/gold-amex",
      }),
    ],
    welcome_bonus: {
      value: welcomeBonus({
        summary: "Up to 50,000 bonus Scene+ points in the first year",
        points: 50000,
      }),
      quote: "Earn up to 50,000 bonus Scene+ points in your first year.",
    },
    promotions: [],
    insurance_highlights: [{ value: "Travel emergency medical", quote: "Travel Emergency Medical Insurance up to $1,000,000" }],
    notes: null,
    ...overrides,
  };
}

export const CATALOG: CatalogCard[] = [
  {
    id: "scotia-gold-amex",
    name: "Gold American Express",
    issuer: "Scotiabank",
    annual_fee: 120,
    network: "Amex",
    point_currency: "Scene+",
    reward_categories: [
      { category: "groceries", earnRate: 5, capMonthly: 2000 },
      { category: "dining", earnRate: 5 },
      { category: "gas", earnRate: 1 },
      { category: "other", earnRate: 1 },
    ],
    welcome_offer: { summary: "40,000 Scene+ points after spend", estimatedValueCad: 400 },
  },
  {
    id: "scotia-scene-visa",
    name: "Scene+ Visa",
    issuer: "Scotiabank",
    annual_fee: 0,
    network: "Visa",
    point_currency: "Scene+",
    reward_categories: [{ category: "other", earnRate: 1 }],
    welcome_offer: null,
  },
];

// ---------------------------------------------------------------------------
// MC2 card-rule fixture pages (synthetic terms shaped like real issuer copy)
// ---------------------------------------------------------------------------

/** Tangerine-style: chosen grocery category with an explicit MCC list in the terms. */
export const TANGERINE_MCC_PAGE = `Tangerine Money-Back Credit Card

Annual fee $0

Earn 2% back on your Grocery category. Eligible grocery purchases are those coded with merchant category codes 5411, 5422 and 5499. Warehouse clubs and gift cards are not eligible.

Earn 0.5% back on all other purchases.`;

export const TANGERINE_URL = "https://www.tangerine.ca/creditcard";

export function tangerineMccExtraction(): CardExtraction {
  return {
    card_name: { value: "Tangerine Money-Back Credit Card", quote: "Tangerine Money-Back Credit Card" },
    issuer: { value: "Tangerine", quote: "Tangerine Money-Back Credit Card" },
    network: null,
    annual_fee: { value: 0, quote: "Annual fee $0" },
    additional_card_fee: null,
    purchase_apr: null,
    cash_advance_apr: null,
    balance_transfer_apr: null,
    fx_fee_percent: null,
    min_personal_income: null,
    min_household_income: null,
    min_credit_limit: null,
    reward_currency: null,
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
    welcome_bonus: null,
    promotions: [],
    insurance_highlights: [],
    notes: null,
  };
}

/** Scotiabank Gold Amex style: named merchants, no MCC codes on the page. */
export const GOLD_NAMED_URL = "https://www.scotiabank.com/gold-amex";

/** Amex Cobalt style: shared monthly cap across groceries + dining, rate after cap. */
export const COBALT_PAGE = `American Express Cobalt Card

Annual fee $12.99 per month

Earn 5 Membership Rewards points for every $1 at restaurants and stand-alone grocery stores in Canada, up to a combined maximum of $2,500 in net purchases posted to your account monthly on these categories. Once the maximum is reached, earn 1 point for every $1 thereafter. Superstores and warehouse clubs are not eligible grocery purchases.

Earn 1 point for every $1 on all other purchases.`;

export const COBALT_URL = "https://www.americanexpress.com/ca/cobalt";

export function cobaltSharedCapExtraction(): CardExtraction {
  const sharedQuote =
    "Earn 5 Membership Rewards points for every $1 at restaurants and stand-alone grocery stores in Canada, up to a combined maximum of $2,500 in net purchases posted to your account monthly on these categories. Once the maximum is reached, earn 1 point for every $1 thereafter. Superstores and warehouse clubs are not eligible grocery purchases.";
  return {
    card_name: { value: "American Express Cobalt Card", quote: "American Express Cobalt Card" },
    issuer: { value: "American Express", quote: "American Express Cobalt Card" },
    network: { value: "American Express", quote: "American Express Cobalt Card" },
    annual_fee: { value: 12.99, quote: "Annual fee $12.99 per month" },
    additional_card_fee: null,
    purchase_apr: null,
    cash_advance_apr: null,
    balance_transfer_apr: null,
    fx_fee_percent: null,
    min_personal_income: null,
    min_household_income: null,
    min_credit_limit: null,
    reward_currency: { value: "Membership Rewards", quote: "Earn 5 Membership Rewards points for every $1" },
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
    welcome_bonus: null,
    promotions: [],
    insurance_highlights: [],
    notes: null,
  };
}

/** Momentum-style spend tier: higher grocery rate after $25,000 annual spend. */
export const MOMENTUM_PAGE = `Scotia Momentum Visa Infinite Card

Annual fee $120

Earn 4% cash back on groceries after you spend $25,000 on purchases in a calendar year. Before you reach $25,000, earn 1% cash back on groceries. Gift cards are excluded from grocery cash back.

Earn 1% cash back on all other purchases.`;

export const MOMENTUM_URL = "https://www.scotiabank.com/momentum";

export function momentumTierExtraction(): CardExtraction {
  return {
    card_name: { value: "Scotia Momentum Visa Infinite Card", quote: "Scotia Momentum Visa Infinite Card" },
    issuer: null,
    network: { value: "Visa", quote: "Scotia Momentum Visa Infinite Card" },
    annual_fee: { value: 120, quote: "Annual fee $120" },
    additional_card_fee: null,
    purchase_apr: null,
    cash_advance_apr: null,
    balance_transfer_apr: null,
    fx_fee_percent: null,
    min_personal_income: null,
    min_household_income: null,
    min_credit_limit: null,
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
    welcome_bonus: null,
    promotions: [],
    insurance_highlights: [],
    notes: null,
  };
}

/** Welcome offer with start/end dates and new-cardholders-only. */
export const WELCOME_DATED_PAGE = `American Express Cobalt Card

Earn up to 30,000 Membership Rewards points as a welcome bonus. This offer is available to new American Express Cobalt Cardmembers only. Offer valid from January 1, 2026 to March 31, 2026.

Earn 10 points per $1 on groceries from March 1, 2026 to March 31, 2026.

Annual fee $12.99 per month
Earn 1 point for every $1 on purchases.`;

export const WELCOME_DATED_URL = "https://www.americanexpress.com/ca/cobalt-offer";

export function welcomeDatedExtraction(): CardExtraction {
  return {
    card_name: { value: "American Express Cobalt Card", quote: "American Express Cobalt Card" },
    issuer: { value: "American Express", quote: "American Express Cobalt Card" },
    network: { value: "American Express", quote: "American Express Cobalt Card" },
    annual_fee: { value: 12.99, quote: "Annual fee $12.99 per month" },
    additional_card_fee: null,
    purchase_apr: null,
    cash_advance_apr: null,
    balance_transfer_apr: null,
    fx_fee_percent: null,
    min_personal_income: null,
    min_household_income: null,
    min_credit_limit: null,
    reward_currency: { value: "Membership Rewards", quote: "Earn up to 30,000 Membership Rewards points" },
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
    insurance_highlights: [],
    notes: null,
  };
}
