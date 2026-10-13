import type { CardExtraction } from "../extract/schema";
import type { CatalogCard } from "../types";

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
      {
        category: "groceries",
        description: "Sobeys, Safeway, FreshCo and more",
        rate: 6,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 6 Scene+ points2 on every $1 CAD you spend in Canada at Sobeys, Safeway, FreshCo and more.",
      },
      {
        category: "dining",
        description: "eligible dining and entertainment",
        rate: 5,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.",
      },
      {
        category: "other",
        description: "all other eligible purchases",
        rate: 1,
        unit: "points_per_dollar",
        cap: null,
        quote: "Earn 1 Scene+ point for every $1 on all other eligible purchases.",
      },
    ],
    welcome_bonus: {
      value: { summary: "Up to 50,000 bonus Scene+ points in the first year", points: 50000, cashback_cad: null },
      quote: "Earn up to 50,000 bonus Scene+ points in your first year.",
    },
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
