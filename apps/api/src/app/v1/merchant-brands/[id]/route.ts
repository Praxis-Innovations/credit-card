import { getMerchantBrand } from "@/lib/catalog";
import { errorResponse, jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";
import { serializeBrand } from "@/lib/serialize";

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
    return jsonResponse(serializeBrand(brand), { request });
  });
}
