import { ApiError } from "@/lib/errors";
import {
  mapSharedStoreFields,
  parseNonNegativeIdMap,
} from "@/lib/recommend-request";
import {
  handleRecommendationPost,
  recommendationOptions,
} from "@/lib/recommendations-http";
import {
  createRecommendation,
  isCategory,
  isFuelGrade,
  type RecommendationRequestBody,
} from "@/lib/recommend";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return recommendationOptions(request);
}

export async function POST(request: Request) {
  return handleRecommendationPost(request, (raw) => {
    if (
      raw.categoryFallback !== undefined &&
      raw.categoryFallback !== null &&
      !isCategory(raw.categoryFallback)
    ) {
      throw new ApiError(
        400,
        "bad_request",
        "categoryFallback must be a known spend category",
      );
    }

    if ("category" in raw && raw.category !== undefined) {
      throw new ApiError(
        400,
        "bad_request",
        "category was removed; send mcc, merchantQuery/osmTag, or categoryFallback",
      );
    }

    const shared = mapSharedStoreFields(raw);
    const input: RecommendationRequestBody = {
      amountCad: raw.amountCad as number,
      ...shared,
      ownedCardIds: Array.isArray(raw.ownedCardIds)
        ? (raw.ownedCardIds as string[])
        : undefined,
      capGroupSpendToDate: parseNonNegativeIdMap(
        raw.capGroupSpendToDate,
        "capGroupSpendToDate",
      ),
      annualSpendByCard: parseNonNegativeIdMap(
        raw.annualSpendByCard,
        "annualSpendByCard",
      ),
      fuelGrade:
        raw.fuelGrade === undefined || raw.fuelGrade === null
          ? undefined
          : isFuelGrade(raw.fuelGrade)
            ? raw.fuelGrade
            : (raw.fuelGrade as RecommendationRequestBody["fuelGrade"]),
      limit: typeof raw.limit === "number" ? raw.limit : undefined,
    };
    return createRecommendation(input);
  });
}
