import { getPartnership } from "@/lib/catalog";
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
    const partnership = await getPartnership(id);
    if (!partnership) {
      return errorResponse(
        404,
        "not_found",
        `Partnership not found: ${id}`,
        { request },
      );
    }
    return jsonResponse(serializePartnership(partnership), { request });
  });
}
