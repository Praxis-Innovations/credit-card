import { jsonResponse } from "./http";
import {
  readRecommendationBody,
  recommendationRouteOptions,
} from "./recommend-route-shared";
import { withAuth } from "./route";

export const recommendationRuntime = "nodejs";

export function recommendationOptions(request: Request) {
  return recommendationRouteOptions(request);
}

export async function handleRecommendationPost<T>(
  request: Request,
  build: (raw: Record<string, unknown>) => Promise<T> | T,
): Promise<Response> {
  return withAuth(request, async () => {
    const raw = await readRecommendationBody(request);
    const result = await build(raw);
    return jsonResponse(result, { request });
  });
}
