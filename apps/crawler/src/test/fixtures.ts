import type { CardExtraction, EarnRate, WelcomeBonus } from "../extract/schema";
import type { CatalogCard } from "../types";

/** Defaults for earn-rate MCC fields so older fixtures stay concise. */
function earnRate(
  partial: Omit<
    EarnRate,
    | "mccs"
    | "merchants"
    | "mcc_source"
    | "exclusions"
    | "cap_amount"
    | "cap_period"
    | "cap_group"
    | "rate_after_cap"
    | "tier_threshold"
    | "valid_from"
    | "valid_to"
    | "source_url"
  > &
    Partial<EarnRate>,
): EarnRate {
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
      partial.mcc_source ?? (mccs.length > 0 || merchants.length > 0 ? "terms" : "network_default"),
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

function welcomeBonus(partial: Pick<WelcomeBonus, "summary"> & Partial<WelcomeBonus>): WelcomeBonus {
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

const GOLD_URL = "https://www.scotiabank.com/gold-amex";

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
    reward_currency: {
      value: "Scene+ points",
      quote: "Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.",
    },
    earn_rates: [
      earnRate({
        category: "groceries",
        description: "Sobeys, Safeway, FreshCo and more",
        rate: 6,
        unit: "points_per_dollar",
        cap: null,
        quote:
          "Earn 6 Scene+ points2 on every $1 CAD you spend in Canada at Sobeys, Safeway, FreshCo and more.",
        merchants: ["Sobeys", "Safeway", "FreshCo"],
        mcc_source: "terms",
        source_url: GOLD_URL,
      }),
      earnRate({
        category: "dining",
        description: "eligible dining and entertainment",
        rate: 5,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.",
        source_url: GOLD_URL,
      }),
      earnRate({
        category: "other",
        description: "all other eligible purchases",
        rate: 1,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 1 Scene+ point for every $1 on all other eligible purchases.",
        source_url: GOLD_URL,
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
    insurance_highlights: [
      { value: "Travel emergency medical", quote: "Travel Emergency Medical Insurance up to $1,000,000" },
    ],
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

export { earnRate, welcomeBonus };
