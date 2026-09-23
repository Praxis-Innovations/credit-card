import { listPartnerships } from "@/lib/catalog";
import { jsonResponse } from "@/lib/http";
import { optionalString, parseLimitOffset } from "@/lib/query";
import { handleOptions, serializePartnership, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const url = new URL(request.url);
    const { limit, offset } = parseLimitOffset(url.searchParams);
    const result = await listPartnerships({
      cardId: optionalString(url.searchParams, "cardId"),
      brandId: optionalString(url.searchParams, "brandId"),
      loyaltyProgramId: optionalString(url.searchParams, "loyaltyProgramId"),
      category: optionalString(url.searchParams, "category"),
      status: optionalString(url.searchParams, "status"),
      limit,
      offset,
    });
    return jsonResponse(
      {
        data: result.data.map(serializePartnership),
        meta: result.meta,
      },
      { request },
    );
  });
}
