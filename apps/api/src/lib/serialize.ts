import {
  SERVABLE_ASSET_RIGHTS,
  type CatalogAsset,
  type CreditCard,
  type LoyaltyProgram,
  type MerchantBrand,
  type MerchantPartnership,
} from "@/domain";
import type { PartnershipRefs } from "./catalog";

/**
 * URL a client may render, or null (→ neutral placeholder). Assets whose
 * rights are not cleared are never exposed, even if a URL is stored.
 */
export function publicAssetUrl(asset: CatalogAsset | undefined): string | null {
  if (!asset?.url) return null;
  return SERVABLE_ASSET_RIGHTS.includes(asset.rightsStatus) ? asset.url : null;
}

export type CardResponse = Omit<CreditCard, "image"> & {
  imageUrl: string | null;
  imageAlt: string | null;
};

export function serializeCard(card: CreditCard): CardResponse {
  const { image, ...rest } = card;
  return {
    ...rest,
    imageUrl: publicAssetUrl(image),
    imageAlt: image?.alt ?? null,
  };
}

/** Compact brand / program reference nested in partnerships and recommendations. */
export interface LogoSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
}

export function summarizeLogo(entity: MerchantBrand | LoyaltyProgram): LogoSummary {
  return {
    id: entity.id,
    name: entity.name,
    logoUrl: publicAssetUrl(entity.logo),
    logoAlt: entity.logo?.alt ?? null,
  };
}

export function serializeBrand(b: MerchantBrand) {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    operator: b.operator ?? null,
    notes: b.notes ?? null,
    sourceUrl: b.sourceUrl,
    lastVerified: b.lastVerified,
    logoUrl: publicAssetUrl(b.logo),
    logoAlt: b.logo?.alt ?? null,
  };
}

export function serializeLoyaltyProgram(p: LoyaltyProgram) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    pointCurrency: p.pointCurrency ?? null,
    sourceUrl: p.sourceUrl,
    lastVerified: p.lastVerified,
    logoUrl: publicAssetUrl(p.logo),
    logoAlt: p.logo?.alt ?? null,
  };
}

/** Serialize partnership for public JSON (camelCase, brandIds alias). */
export function serializePartnership(
  p: MerchantPartnership & { status?: string },
  refs: PartnershipRefs,
) {
  const program = p.loyaltyProgramId
    ? refs.programs.get(p.loyaltyProgramId)
    : undefined;
  return {
    id: p.id,
    brandIds: p.merchantBrandIds,
    merchantBrandIds: p.merchantBrandIds,
    /** Verified brands for `brandIds`, in the same order; unknown ids are skipped. */
    brands: p.merchantBrandIds.flatMap((id) => {
      const brand = refs.brands.get(id);
      return brand ? [summarizeLogo(brand)] : [];
    }),
    loyaltyProgramId: p.loyaltyProgramId,
    loyaltyProgram: program ? summarizeLogo(program) : null,
    cardIds: p.cardIds,
    affiliation: p.affiliation,
    requirements: p.requirements,
    benefits: p.benefits,
    stacksWithCardCategoryRewards: p.stacksWithCardCategoryRewards,
    notes: p.notes ?? null,
    sourceUrls: p.sourceUrls,
    /** Primary source for convenience (first cited URL). */
    sourceUrl: p.sourceUrls[0] ?? null,
    lastVerified: p.lastVerified,
    status: p.status ?? "verified",
  };
}
