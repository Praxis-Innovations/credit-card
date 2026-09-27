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

/** Brand / loyalty program reference nested in partnerships and recommendations. */
export interface LogoSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
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

export interface SpendToDate {
  monthly?: Partial<Record<Category, number>>;
  annual?: Partial<Record<Category, number>>;
}

export type FuelGrade = "regular" | "premium";

export interface RecommendationRequest {
  amountCad: number;
  category: Category;
  merchant?: string;
  /** Raw free-text brand/name (e.g. OSM "Shell") — resolved server-side. */
  merchantQuery?: string;
  ownedCardIds?: string[];
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
  /** Grade being pumped; premium unlocks grade-scoped benefits. Server default: regular. */
  fuelGrade?: FuelGrade;
  limit?: number;
}

export type ValueBreakdownKind =
  | "card_earn"
  | "cents_per_litre_instant"
  | "cents_per_litre_rewards"
  | "points_per_litre"
  | "points_per_dollar"
  | "cashback_percent";

/** One dollar line of a recommendation; lines sum exactly to estimatedRewardCad. */
export interface ValueBreakdownItem {
  label: string;
  kind: ValueBreakdownKind;
  /** Whole-cent CAD amount. */
  amountCad: number;
  partnershipId?: string;
  points?: number;
  pointCurrency?: PointCurrency;
  centsPerPoint?: number;
  promotional?: boolean;
  /** Present when promotional; null if no end date is published. */
  promotionalEnds?: string | null;
}

export interface ValueAssumptions {
  /** Assumed pump price; null when no per-litre benefit applied. */
  cadPerLitre: number | null;
  litres: number | null;
  /** Cents CAD per point for each currency valued in the breakdown. */
  pointValuations: Partial<Record<PointCurrency, number>>;
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
  /** Brand resolved from merchantQuery. */
  merchantBrand?: LogoSummary | null;
  /** Loyalty program of the partnership that drove this item. */
  loyaltyProgram?: LogoSummary | null;
  /** Always sent by current API; optional for cached responses from older builds. */
  valueBreakdown?: ValueBreakdownItem[];
  assumptions?: ValueAssumptions;
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
    merchant: string | null;
    merchantQuery?: string | null;
    merchantBrandId?: string | null;
    merchantBrand?: LogoSummary | null;
    fuelGrade?: FuelGrade | null;
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
