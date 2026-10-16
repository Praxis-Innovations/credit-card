import { ApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/http";
import {
  createRecommendationPreview,
  isCategory,
  isFuelGrade,
  isMccCode,
  type PreviewRequestBody,
} from "@/lib/recommend";
import { handleOptions, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

/** Admin console: card + store/mcc + amount → single recommendation. */
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

    if (typeof raw.cardId !== "string" || !raw.cardId.trim()) {
      throw new ApiError(400, "bad_request", "cardId is required");
    }
    if (raw.mcc !== undefined && raw.mcc !== null && !isMccCode(raw.mcc)) {
      throw new ApiError(400, "bad_request", "mcc must be a 4-digit code");
    }

    const input: PreviewRequestBody = {
      amountCad: raw.amountCad as number,
      cardId: raw.cardId.trim(),
      mcc: typeof raw.mcc === "string" ? raw.mcc : undefined,
      merchant: typeof raw.merchant === "string" ? raw.merchant : undefined,
      merchantQuery:
        typeof raw.merchantQuery === "string" ? raw.merchantQuery : undefined,
      osmTag: typeof raw.osmTag === "string" ? raw.osmTag : undefined,
      categoryFallback: isCategory(raw.categoryFallback)
        ? raw.categoryFallback
        : undefined,
      fuelGrade:
        raw.fuelGrade === undefined || raw.fuelGrade === null
          ? undefined
          : isFuelGrade(raw.fuelGrade)
            ? raw.fuelGrade
            : undefined,
      spendToDate:
        raw.spendToDate && typeof raw.spendToDate === "object"
          ? (raw.spendToDate as PreviewRequestBody["spendToDate"])
          : undefined,
      valuations:
        raw.valuations && typeof raw.valuations === "object"
          ? (raw.valuations as PreviewRequestBody["valuations"])
          : undefined,
    };

    const result = await createRecommendationPreview(input);
    return jsonResponse(result, { request });
  });
}
