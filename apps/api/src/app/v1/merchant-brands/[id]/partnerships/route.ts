import {
  getMerchantBrand,
  listPartnerships,
  loadPartnershipRefs,
} from "@/lib/catalog";
import { errorResponse, jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";
import { serializePartnership } from "@/lib/serialize";

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
    const [result, refs] = await Promise.all([
      listPartnerships({
        brandId: id,
        limit: 200,
        offset: 0,
      }),
      loadPartnershipRefs(),
    ]);
    return jsonResponse(
      {
        brandId: id,
        data: result.data.map((p) => serializePartnership(p, refs)),
        meta: result.meta,
      },
      { request },
    );
  });
}
