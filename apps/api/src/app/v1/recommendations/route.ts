import { ApiError } from "@/lib/errors";
import { mapSharedStoreFields } from "@/lib/recommend-request";
import {
  handleRecommendationPost,
  recommendationOptions,
  recommendationRuntime,
} from "@/lib/recommendations-http";
import {
  createRecommendation,
  isCategory,
  isFuelGrade,
  type RecommendationRequestBody,
} from "@/lib/recommend";

export const runtime = recommendationRuntime;

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
      capGroupSpendToDate:
        raw.capGroupSpendToDate && typeof raw.capGroupSpendToDate === "object"
          ? (raw.capGroupSpendToDate as Record<string, number>)
          : undefined,
      annualSpendByCard:
        raw.annualSpendByCard && typeof raw.annualSpendByCard === "object"
          ? (raw.annualSpendByCard as Record<string, number>)
          : undefined,
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
