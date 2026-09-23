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
}

export interface SpendToDate {
  monthly?: Partial<Record<Category, number>>;
  annual?: Partial<Record<Category, number>>;
}

export interface RecommendationRequest {
  amountCad: number;
  category: Category;
  merchant?: string;
  /** Raw free-text brand/name (e.g. OSM "Shell") — resolved server-side. */
  merchantQuery?: string;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
  limit?: number;
}

export interface RecommendationItem {
  rank: number;
  card: CreditCard;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  usedPartnership?: boolean;
  partnershipId?: string;
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
    merchant: string | null;
    merchantQuery?: string | null;
    merchantBrandId?: string | null;
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
