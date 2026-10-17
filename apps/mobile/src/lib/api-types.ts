/**
 * Wire-format types for apps/api — kept in sync with docs/api/openapi.yaml by hand.
 * Types only: no ranking, matching, or catalog data.
 * CATEGORIES / CATEGORY_LABELS live in @northtap/api-contract (shared with apps/api).
 */

export {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "@northtap/api-contract";

import type { Category } from "@northtap/api-contract";

export type PointCurrency = string;

export type MccCertainty =
  | "confirmed"
  | "varies_by_store"
  | "varies_by_network"
  | "varies_by_product"
  | "estimate"
  | "category_only"
  | "unknown";

export type MccMatchKind =
  | "named_merchant"
  | "mcc_list"
  | "category_default"
  | "store_type_estimate"
  | "user_category"
  | "base_rate"
  | "network_not_accepted";

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
  mcc?: string | null;
  amexMcc?: string | null;
  certainty?: MccCertainty;
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
 * MCC recommend: amount + store (`merchantQuery` / `osmTag`) and/or optional
 * `categoryFallback` when the store type is unknown. Legacy `category` is rejected.
 * In-store is assumed; the app never sends `mcc` or brand ids.
 */
export interface RecommendationRequest {
  amountCad: number;
  ownedCardIds?: string[];
  merchantQuery?: string;
  merchant?: string;
  osmTag?: string;
  categoryFallback?: Category;
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
  /** Points per $1 (or % cash back) for the resolved MCC / display category. */
  earnRate: number;
  /** Cents per point (1 for cash back). */
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  matchKind?: MccMatchKind;
  confidence?: MccCertainty;
  effectiveMcc?: string | null;
  /** Always sent by current API; optional for cached responses from older builds. */
  valueBreakdown?: ValueBreakdownItem[];
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    mcc: string | null;
    displayCategory: Category;
    merchant: string | null;
    merchantQuery?: string | null;
    certainty?: MccCertainty;
    matchKind?: MccMatchKind;
  };
  recommendations: RecommendationItem[];
  bestCardId: string | null;
  warnings?: Array<{ kind: string; message: string }>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
