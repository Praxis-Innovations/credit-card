import { ApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/http";
import {
  createRecommendation,
  isCategory,
  isFuelGrade,
  isMccCode,
  type RecommendationRequestBody,
} from "@/lib/recommend";
import { handleOptions, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  return withAuth(request, async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "bad_request", "Request body must be JSON");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError(400, "bad_request", "Request body must be an object");
    }

    const raw = body as Record<string, unknown>;
    const amountCad = raw.amountCad;

    if (raw.mcc !== undefined && raw.mcc !== null && !isMccCode(raw.mcc)) {
      throw new ApiError(400, "bad_request", "mcc must be a 4-digit code");
    }

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

    // Reject legacy `category` so clients migrate to mcc / store.
    if ("category" in raw && raw.category !== undefined) {
      throw new ApiError(
        400,
        "bad_request",
        "category was removed; send mcc, merchantQuery/osmTag, or categoryFallback",
      );
    }

    const input: RecommendationRequestBody = {
      amountCad: amountCad as number,
      mcc: typeof raw.mcc === "string" ? raw.mcc : undefined,
      merchant: typeof raw.merchant === "string" ? raw.merchant : undefined,
      merchantQuery:
        typeof raw.merchantQuery === "string"
          ? raw.merchantQuery
          : undefined,
      osmTag: typeof raw.osmTag === "string" ? raw.osmTag : undefined,
      categoryFallback: isCategory(raw.categoryFallback)
        ? raw.categoryFallback
        : undefined,
      ownedCardIds: Array.isArray(raw.ownedCardIds)
        ? (raw.ownedCardIds as string[])
        : undefined,
      spendToDate:
        raw.spendToDate && typeof raw.spendToDate === "object"
          ? (raw.spendToDate as RecommendationRequestBody["spendToDate"])
          : undefined,
      capGroupSpendToDate:
        raw.capGroupSpendToDate && typeof raw.capGroupSpendToDate === "object"
          ? (raw.capGroupSpendToDate as Record<string, number>)
          : undefined,
      annualSpendByCard:
        raw.annualSpendByCard && typeof raw.annualSpendByCard === "object"
          ? (raw.annualSpendByCard as Record<string, number>)
          : undefined,
      valuations:
        raw.valuations && typeof raw.valuations === "object"
          ? (raw.valuations as RecommendationRequestBody["valuations"])
          : undefined,
      fuelGrade:
        raw.fuelGrade === undefined || raw.fuelGrade === null
          ? undefined
          : isFuelGrade(raw.fuelGrade)
            ? raw.fuelGrade
            : (raw.fuelGrade as RecommendationRequestBody["fuelGrade"]),
      limit: typeof raw.limit === "number" ? raw.limit : undefined,
    };

    const result = await createRecommendation(input);
    return jsonResponse(result, { request });
  });
}
