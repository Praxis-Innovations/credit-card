import { getLoyaltyProgram } from "@/lib/catalog";
import { errorResponse, jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";
import { serializeLoyaltyProgram } from "@/lib/serialize";

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
    const program = await getLoyaltyProgram(id);
    if (!program) {
      return errorResponse(
        404,
        "not_found",
        `Loyalty program not found: ${id}`,
        { request },
      );
    }
    return jsonResponse(serializeLoyaltyProgram(program), { request });
  });
}
