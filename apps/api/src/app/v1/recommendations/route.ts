import { ApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/http";
import {
  createRecommendation,
  isCategory,
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
    const category = raw.category;

    if (!isCategory(category)) {
      throw new ApiError(
        400,
        "bad_request",
        "category must be a known spend category",
      );
    }

    const input: RecommendationRequestBody = {
      amountCad: amountCad as number,
      category,
      merchant: typeof raw.merchant === "string" ? raw.merchant : undefined,
      merchantBrandId:
        typeof raw.merchantBrandId === "string"
          ? raw.merchantBrandId
          : undefined,
      ownedCardIds: Array.isArray(raw.ownedCardIds)
        ? (raw.ownedCardIds as string[])
        : undefined,
      spendToDate:
        raw.spendToDate && typeof raw.spendToDate === "object"
          ? (raw.spendToDate as RecommendationRequestBody["spendToDate"])
          : undefined,
      valuations:
        raw.valuations && typeof raw.valuations === "object"
          ? (raw.valuations as RecommendationRequestBody["valuations"])
          : undefined,
      limit: typeof raw.limit === "number" ? raw.limit : undefined,
    };

    const result = await createRecommendation(input);
    return jsonResponse(result, { request });
  });
}
