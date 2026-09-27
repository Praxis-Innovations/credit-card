import { ApiError } from "./errors";
import { requireApiKey } from "./auth";
import { fromApiError, jsonResponse, optionsResponse } from "./http";

export function handleOptions(request: Request) {
  return optionsResponse(request);
}

export async function withAuth(
  request: Request,
  handler: (ctx: {
    rateLimitHeaders: Record<string, string>;
  }) => Promise<Response>,
): Promise<Response> {
  try {
    const { rateLimitHeaders } = await requireApiKey(request);
    const response = await handler({ rateLimitHeaders });
    // Attach rate-limit headers if the handler returned a NextResponse-like object
    for (const [k, v] of Object.entries(rateLimitHeaders)) {
      response.headers.set(k, v);
    }
    return response;
  } catch (err) {
    if (err instanceof ApiError) {
      const res = fromApiError(err, request);
      return res;
    }
    console.error(err);
    return jsonResponse(
      {
        error: {
          code: "internal_error",
          message: "Internal server error",
        },
      },
      { status: 500, request },
    );
  }
}
