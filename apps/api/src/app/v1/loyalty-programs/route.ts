import { listLoyaltyPrograms } from "@/lib/catalog";
import { jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const programs = await listLoyaltyPrograms();
    return jsonResponse(
      {
        data: programs.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          pointCurrency: p.pointCurrency ?? null,
          sourceUrl: p.sourceUrl,
          lastVerified: p.lastVerified,
        })),
      },
      { request },
    );
  });
}
