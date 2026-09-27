import { getLoyaltyProgram } from "@/lib/catalog";
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
    const program = await getLoyaltyProgram(id);
    if (!program) {
      return errorResponse(
        404,
        "not_found",
        `Loyalty program not found: ${id}`,
        { request },
      );
    }
    return jsonResponse(
      {
        id: program.id,
        name: program.name,
        description: program.description ?? null,
        pointCurrency: program.pointCurrency ?? null,
        sourceUrl: program.sourceUrl,
        lastVerified: program.lastVerified,
      },
      { request },
    );
  });
}
