import { listCategoriesResponse } from "@/lib/recommend";
import { jsonResponse } from "@/lib/http";
import { handleOptions, withAuth } from "@/lib/route";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return withAuth(request, async () => {
    return jsonResponse(listCategoriesResponse(), { request });
  });
}
