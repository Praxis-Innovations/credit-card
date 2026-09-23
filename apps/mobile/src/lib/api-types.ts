import type {
  Category,
  CreditCard,
  PointCurrency,
  SpendToDate,
} from "@northtap/core";

export interface RecommendationRequest {
  amountCad: number;
  category: Category;
  merchant?: string;
  /** When set, ranks with partnership-aware merchant logic. */
  merchantBrandId?: string;
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
