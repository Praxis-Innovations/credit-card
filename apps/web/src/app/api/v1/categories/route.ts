import { CATEGORIES, CATEGORY_LABELS } from "@northtap/core";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    categories: CATEGORIES.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
    })),
  });
}
