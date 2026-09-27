import { getCard } from "@/lib/catalog";
import { errorResponse, jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";

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
    const card = await getCard(id);
    if (!card) {
      return errorResponse(404, "not_found", `Card not found: ${id}`, {
        request,
      });
    }
    return jsonResponse(card, { request });
  });
}
