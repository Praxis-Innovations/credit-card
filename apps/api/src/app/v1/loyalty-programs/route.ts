import { listLoyaltyPrograms } from "@/lib/catalog";
import { jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";
import { serializeLoyaltyProgram } from "@/lib/serialize";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    const programs = await listLoyaltyPrograms();
    return jsonResponse(
      { data: programs.map(serializeLoyaltyProgram) },
      { request },
    );
  });
}
