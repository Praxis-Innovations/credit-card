import { listCards } from "@/lib/catalog";
import { ApiError } from "@/lib/errors";
import { jsonResponse } from "@/lib/http";
import {
  optionalNumber,
  optionalString,
  parseLimitOffset,
} from "@/lib/query";
import { handleOptions, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const url = new URL(request.url);
    const { limit, offset } = parseLimitOffset(url.searchParams);
    const maxAnnualFee = optionalNumber(url.searchParams, "maxAnnualFee");
    if (maxAnnualFee !== undefined && maxAnnualFee < 0) {
      throw new ApiError(400, "bad_request", "maxAnnualFee must be >= 0");
    }

    const result = await listCards({
      issuer: optionalString(url.searchParams, "issuer"),
      category: optionalString(url.searchParams, "category"),
      pointCurrency: optionalString(url.searchParams, "pointCurrency"),
      network: optionalString(url.searchParams, "network"),
      maxAnnualFee,
      q: optionalString(url.searchParams, "q"),
      limit,
      offset,
    });

    return jsonResponse(result, { request });
  });
}
