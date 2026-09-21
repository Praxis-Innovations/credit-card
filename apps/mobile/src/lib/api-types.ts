/**
 * Client types aligned with docs/api/openapi.yaml / apps/web/src/lib/api-types.ts.
 * Keep shapes consistent so Expo and Next share the same recommendation model.
 */

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
}

export interface RecommendationResponse {
  purchase: {
    amountCad: number;
    category: Category;
    merchant: string | null;
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
