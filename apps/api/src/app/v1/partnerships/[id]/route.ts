import { getPartnership, loadPartnershipRefs } from "@/lib/catalog";
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
    const partnership = await getPartnership(id);
    if (!partnership) {
      return errorResponse(
        404,
        "not_found",
        `Partnership not found: ${id}`,
        { request },
      );
    }
    const refs = await loadPartnershipRefs();
    return jsonResponse(serializePartnership(partnership, refs), { request });
  });
}
