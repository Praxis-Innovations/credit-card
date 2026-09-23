import { listMerchantBrands } from "@/lib/catalog";
import { jsonResponse } from "@/lib/http";
import { optionalString, parseLimitOffset } from "@/lib/query";
import { handleOptions, withAuth } from "@/lib/route";
import { serializeBrand } from "@/lib/serialize";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const url = new URL(request.url);
    const { limit, offset } = parseLimitOffset(url.searchParams);
    const result = await listMerchantBrands({
      category: optionalString(url.searchParams, "category"),
      q: optionalString(url.searchParams, "q"),
      limit,
      offset,
    });
    return jsonResponse(
      {
        data: result.data.map(serializeBrand),
        meta: result.meta,
      },
      { request },
    );
  });
}
