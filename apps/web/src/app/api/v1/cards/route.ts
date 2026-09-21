import { CARDS, type Category, type Issuer, type PointCurrency } from "@northtap/core";
import { isCategory, jsonError } from "@/lib/recommend-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const issuer = url.searchParams.get("issuer");
  const network = url.searchParams.get("network");
  const pointCurrency = url.searchParams.get("pointCurrency");
  const categoryParam = url.searchParams.get("category");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const maxAnnualFee = url.searchParams.get("maxAnnualFee");
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1),
    200,
  );
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

  if (categoryParam && !isCategory(categoryParam)) {
    return jsonError(400, "bad_request", "Invalid category filter");
  }

  let filtered = [...CARDS];

  if (issuer) {
    filtered = filtered.filter((c) => c.issuer === (issuer as Issuer));
  }
  if (network) {
    filtered = filtered.filter((c) => c.network === network);
  }
  if (pointCurrency) {
    filtered = filtered.filter(
      (c) => c.pointCurrency === (pointCurrency as PointCurrency),
    );
  }
  if (categoryParam) {
    const category = categoryParam as Category;
    filtered = filtered.filter((c) =>
      c.rewardCategories.some(
        (r) => r.category === category || r.category === "other",
      ),
    );
  }
  if (maxAnnualFee !== null && maxAnnualFee !== "") {
    const max = Number(maxAnnualFee);
    if (!Number.isFinite(max) || max < 0) {
      return jsonError(400, "bad_request", "maxAnnualFee must be a non-negative number");
    }
    filtered = filtered.filter((c) => c.annualFee <= max);
  }
  if (q) {
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => {
    const issuerCmp = a.issuer.localeCompare(b.issuer);
    if (issuerCmp !== 0) return issuerCmp;
    return a.name.localeCompare(b.name);
  });

  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);

  return Response.json({
    data,
    meta: { total, limit, offset },
  });
}
