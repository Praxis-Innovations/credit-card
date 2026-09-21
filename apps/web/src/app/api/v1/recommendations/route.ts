import { createSupabaseUserClient, readBearerToken } from "@/lib/supabase/server";
import {
  buildRecommendationResponse,
  jsonError,
} from "@/lib/recommend-api";
import type { RecommendationRequest } from "@/lib/api-types";

export const runtime = "nodejs";

async function resolveOwnedCardIds(
  request: Request,
  body: RecommendationRequest,
): Promise<string[] | { error: Response }> {
  if (body.ownedCardIds && body.ownedCardIds.length > 0) {
    return body.ownedCardIds;
  }

  const token = readBearerToken(request);
  if (!token) {
    return {
      error: jsonError(
        422,
        "empty_wallet",
        "ownedCardIds is required when unauthenticated",
      ),
    };
  }

  const supabase = createSupabaseUserClient(token);
  if (!supabase) {
    return {
      error: jsonError(
        503,
        "supabase_unconfigured",
        "Supabase env vars are not set; pass ownedCardIds for guest recommendations",
      ),
    };
  }

  const { data, error } = await supabase
    .from("user_cards")
    .select("card_id")
    .order("added_at", { ascending: true });

  if (error) {
    return {
      error: jsonError(401, "unauthorized", "Could not load wallet from Supabase", {
        message: error.message,
      }),
    };
  }

  return (data ?? []).map((row) => row.card_id as string);
}

export async function POST(request: Request) {
  let body: RecommendationRequest;
  try {
    body = (await request.json()) as RecommendationRequest;
  } catch {
    return jsonError(400, "bad_request", "Request body must be JSON");
  }

  const owned = await resolveOwnedCardIds(request, body);
  if (typeof owned === "object" && "error" in owned) {
    return owned.error;
  }

  const result = buildRecommendationResponse({
    ...body,
    ownedCardIds: owned,
  });

  if ("error" in result) {
    return jsonError(result.status, result.error.code, result.error.message, result.error.details);
  }

  return Response.json(result);
}
