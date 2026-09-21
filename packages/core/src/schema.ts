/**
 * Normalized spending categories for Canadian credit card rewards.
 */
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

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: "Groceries",
  dining: "Dining",
  gas: "Gas",
  transit: "Transit",
  drugstore: "Drugstore",
  recurring_bills: "Recurring bills",
  travel: "Travel",
  foreign_currency: "Foreign currency",
  entertainment: "Entertainment",
  other: "Everything else",
};

/**
 * Point / reward currencies common on Canadian cards.
 */
export const POINT_CURRENCIES = [
  "Aeroplan",
  "Scene+",
  "TD Rewards",
  "RBC Avion",
  "CIBC Aventura",
  "Amex MR",
  "BMO Rewards",
  "WestJet",
  "AIR MILES",
  "Marriott Bonvoy",
  "cashback",
  "PC Optimum",
  "Rogers",
  "Triangle",
] as const;

export type PointCurrency = (typeof POINT_CURRENCIES)[number];

export const ISSUERS = [
  "American Express",
  "TD",
  "CIBC",
  "Scotiabank",
  "RBC",
  "BMO",
  "Rogers",
  "Tangerine",
  "PC Financial",
  "Simplii",
  "Neo",
  "Canadian Tire",
  "National Bank",
  "Desjardins",
  "HSBC",
  "MBNA",
] as const;

export type Issuer = (typeof ISSUERS)[number];

export interface RewardCategory {
  category: Category;
  /** Points (or cashback cents) earned per dollar spent. */
  earnRate: number;
  /** Optional monthly earn cap in dollars of spend. */
  capMonthly?: number;
  /** Optional annual earn cap in dollars of spend. */
  capAnnual?: number;
}

export interface WelcomeOffer {
  summary: string;
  /** Rough CAD value of the offer when completed. */
  estimatedValueCad?: number;
}

export interface CreditCard {
  id: string;
  issuer: Issuer;
  name: string;
  annualFee: number;
  pointCurrency: PointCurrency;
  rewardCategories: RewardCategory[];
  /** ISO date string — when rates were last spot-checked. */
  lastVerified: string;
  welcomeOffer?: WelcomeOffer;
  network?: "Visa" | "Mastercard" | "Amex";
  /** Optional marketing tier label shown in UI. */
  tier?: string;
}

export interface PointValuations {
  [currency: string]: number;
}

export interface SpendToDate {
  /** Spend already applied toward a monthly cap this period (CAD). */
  monthly?: Partial<Record<Category, number>>;
  /** Spend already applied toward an annual cap this year (CAD). */
  annual?: Partial<Record<Category, number>>;
}

export interface RecommendationInput {
  ownedCardIds: string[];
  category: Category;
  /** Optional spend-to-date for cap exhaustion. Not persisted by the engine. */
  spendToDate?: SpendToDate;
  /** Override default point valuations (cents CAD per point). */
  valuations?: Partial<Record<PointCurrency, number>>;
  /** Optional card catalog override (defaults to built-in dataset). */
  cards?: CreditCard[];
}

export interface Recommendation {
  card: CreditCard;
  /** Effective earn rate after caps (points or cashback cents per $). */
  earnRate: number;
  /** Cents CAD per point (or 1 for cashback). */
  pointValue: number;
  /** cents-back-per-dollar = earnRate × pointValue */
  centsPerDollar: number;
  /** True when a spend cap has been fully exhausted for this category. */
  capExhausted: boolean;
  reason: string;
}
