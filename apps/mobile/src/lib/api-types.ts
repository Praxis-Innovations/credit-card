/**
 * Wire-format types for apps/api — kept in sync with docs/api/openapi.yaml by hand.
 * Types only: no ranking, matching, or catalog data.
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

export type PointCurrency = string;

export interface RewardCategory {
  category: Category;
  earnRate: number;
  capMonthly?: number;
  capAnnual?: number;
}

export interface WelcomeOffer {
  summary: string;
  estimatedValueCad?: number;
}

/*
 * Image fields: null means "no rights-cleared asset" — render a neutral
 * placeholder (card-shaped tile for cards, initial-letter tile for brands /
 * programs). See docs/data/ASSETS.md. Optional because responses cached
 * before these fields existed won't carry them.
 */

/** Credit card as returned by GET /v1/cards and recommendation payloads. */
export interface CreditCard {
  id: string;
  issuer: string;
  name: string;
  annualFee: number;
  pointCurrency: PointCurrency;
  rewardCategories: RewardCategory[];
  lastVerified: string;
  welcomeOffer?: WelcomeOffer;
  network?: "Visa" | "Mastercard" | "Amex";
  tier?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
}

/** GET /v1/merchant-brands(/:id) */
export interface MerchantBrand {
  id: string;
  name: string;
  category: Category;
  operator: string | null;
  notes: string | null;
  sourceUrl: string;
  lastVerified: string;
  logoUrl?: string | null;
  logoAlt?: string | null;
}

/** GET /v1/loyalty-programs(/:id) */
export interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  pointCurrency: PointCurrency | null;
  sourceUrl: string;
  lastVerified: string;
  logoUrl?: string | null;
  logoAlt?: string | null;
}

/** GET /v1/categories */
export interface CategoryInfo {
  id: Category;
  label: string;
}

export interface SpendToDate {
  monthly?: Partial<Record<Category, number>>;
  annual?: Partial<Record<Category, number>>;
}

/**
 * v1 ranks purely by category earn rate: the app never sends the API's
 * merchant / merchantQuery / fuelGrade inputs.
 */
export interface RecommendationRequest {
  amountCad: number;
  category: Category;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
  limit?: number;
}

/** One dollar line of a recommendation; lines sum exactly to estimatedRewardCad. */
export interface ValueBreakdownItem {
  label: string;
  kind: string;
  /** Whole-cent CAD amount. */
  amountCad: number;
  /** Points earned on this purchase, for point-denominated lines. */
  points?: number;
  pointCurrency?: PointCurrency;
  centsPerPoint?: number;
  promotional?: boolean;
  /** Present when promotional; null if no end date is published. */
  promotionalEnds?: string | null;
}

export interface RecommendationItem {
  rank: number;
  card: CreditCard;
  /** Points per $1 (or % cash back) in the purchase category. */
  earnRate: number;
  /** Cents per point (1 for cash back). */
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  /** Always sent by current API; optional for cached responses from older builds. */
  valueBreakdown?: ValueBreakdownItem[];
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
  };
  recommendations: RecommendationItem[];
  bestCardId: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
