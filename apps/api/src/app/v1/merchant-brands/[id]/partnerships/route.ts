import { getMerchantBrand, listPartnerships } from "@/lib/catalog";
import { errorResponse, jsonResponse } from "@/lib/http";
import { handleOptions, serializePartnership, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    const { id } = await context.params;
    const brand = await getMerchantBrand(id);
    if (!brand) {
      return errorResponse(
        404,
        "not_found",
        `Merchant brand not found: ${id}`,
        { request },
      );
    }
    const result = await listPartnerships({
      brandId: id,
      limit: 200,
      offset: 0,
    });
    return jsonResponse(
      {
        brandId: id,
        data: result.data.map(serializePartnership),
        meta: result.meta,
      },
      { request },
    );
  });
}
