import { ApiError } from "@/lib/errors";
import { mapSharedStoreFields } from "@/lib/recommend-request";
import {
  handleRecommendationPost,
  recommendationOptions,
} from "@/lib/recommendations-http";
import {
  createRecommendationPreview,
  type PreviewRequestBody,
} from "@/lib/recommend";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return recommendationOptions(request);
}

/** Admin console: card + store/mcc + amount → single recommendation. */
export async function POST(request: Request) {
  return handleRecommendationPost(request, (raw) => {
    if (typeof raw.cardId !== "string" || !raw.cardId.trim()) {
      throw new ApiError(400, "bad_request", "cardId is required");
    }
    const shared = mapSharedStoreFields(raw);
    const input: PreviewRequestBody = {
      amountCad: raw.amountCad as number,
      cardId: raw.cardId.trim(),
      ...shared,
    };
    return createRecommendationPreview(input);
  });
}
