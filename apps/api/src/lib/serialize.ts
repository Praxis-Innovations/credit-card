import type { MerchantBrand } from "@northtap/core";

export function serializeBrand(b: MerchantBrand) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    operator: b.operator ?? null,
    notes: b.notes ?? null,
    sourceUrl: b.sourceUrl,
    lastVerified: b.lastVerified,
  };
}
