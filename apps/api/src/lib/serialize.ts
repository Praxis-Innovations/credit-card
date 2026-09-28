import {
  SERVABLE_ASSET_RIGHTS,
  type AssetRightsStatus,
  type CatalogAsset,
  type CreditCard,
  type LoyaltyProgram,
  type MerchantBrand,
  type MerchantPartnership,
} from "@/domain";
import { fallbackAlt } from "@/assets/card-art/fallback";
import type { PartnershipRefs } from "./catalog";

/**
 * `unknown`-provenance assets (e.g. art fetched from issuer product pages for
 * dev) are served only when NORTHTAP_SERVE_UNLICENSED_ASSETS=true.
 */
export function serveUnlicensedAssets(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NORTHTAP_SERVE_UNLICENSED_ASSETS?.trim().toLowerCase() === "true";
}

export function isServableRights(
  rights: AssetRightsStatus,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (SERVABLE_ASSET_RIGHTS.includes(rights)) return true;
  return rights === "unknown" && serveUnlicensedAssets(env);
}

/**
 * URL a client may render, or null (→ neutral placeholder). A stored URL whose
 * rights are not servable is never exposed; the generated fallback is used
 * instead when there is one.
 */
export function publicAssetUrl(
  asset: CatalogAsset | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!asset) return null;
  if (asset.url && isServableRights(asset.rightsStatus, env)) return asset.url;
  return asset.fallbackUrl ?? null;
}

export type CardResponse = Omit<CreditCard, "image"> & {
  imageUrl: string | null;
  imageAlt: string | null;
};

export function serializeCard(card: CreditCard): CardResponse {
  const { image, ...rest } = card;
  const imageUrl = publicAssetUrl(image);
  const servesFallback = !!imageUrl && imageUrl !== image?.url;
  return {
    ...rest,
    imageUrl,
    imageAlt: servesFallback ? fallbackAlt(card) : image?.alt ?? null,
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
