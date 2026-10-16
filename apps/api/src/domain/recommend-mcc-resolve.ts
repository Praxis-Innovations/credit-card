import type { AcceptedNetwork, Category, CreditCard, MccCertainty, MerchantBrand } from "./schema";
import { CATEGORY_LABELS } from "./schema";
import type {
  MccCatalog,
  MccRecommendationInput,
  RecommendationWarning,
  ResolvedStoreCode,
} from "./recommend-mcc-types";

const UNCERTAIN_CERTAINTIES = new Set<MccCertainty>([
  "varies_by_store",
  "varies_by_network",
  "varies_by_product",
  "estimate",
  "category_only",
  "unknown",
]);

function brandMccForNetwork(
  brand: MerchantBrand,
  network: CreditCard["network"],
): string | null {
  if (network === "Amex" && brand.amexMcc) return brand.amexMcc;
  return brand.mcc ?? null;
}

function categoryForMcc(
  mcc: string | null,
  mccCatalog: MccCatalog | undefined,
  brand: MerchantBrand | null,
  fallback?: Category,
): Category {
  if (brand?.category) return brand.category;
  if (mcc && mccCatalog?.categoryMccs) {
    const hit = mccCatalog.categoryMccs.find((r) => r.mcc === mcc);
    if (hit) return hit.category;
  }
  return fallback ?? "other";
}

function certaintyWarnings(
  certainty: MccCertainty,
  code: string | null,
): RecommendationWarning[] {
  if (!UNCERTAIN_CERTAINTIES.has(certainty)) return [];
  if (!code && certainty === "unknown") return [];
  return [
    {
      kind: "certainty",
      message: `Store code certainty is ${certainty.replaceAll("_", " ")}`,
    },
  ];
}

type ResolveInput = Pick<
  MccRecommendationInput,
  "store" | "mcc" | "categoryFallback" | "brands" | "mccCatalog"
>;

function findBrand(input: ResolveInput): MerchantBrand | null {
  if (!input.store?.brandId) return null;
  const brands = input.brands ?? [];
  return brands.find((b) => b.id === input.store!.brandId) ?? null;
}

function resolveFromExplicitMcc(
  explicitMcc: string,
  brand: MerchantBrand | null,
  input: ResolveInput,
  warnings: RecommendationWarning[],
): ResolvedStoreCode {
  return {
    mcc: explicitMcc,
    brand,
    certainty: "confirmed",
    matchKind: "mcc_list",
    displayCategory: categoryForMcc(
      explicitMcc,
      input.mccCatalog,
      brand,
      input.categoryFallback,
    ),
    warnings,
  };
}

function resolveFromOsmTag(
  osmTag: string,
  brand: MerchantBrand | null,
  input: ResolveInput,
  warnings: RecommendationWarning[],
): ResolvedStoreCode | null {
  const hit = input.mccCatalog?.storeTypeMccs?.find((r) => r.osmTag === osmTag);
  if (!hit) return null;
  return {
    mcc: hit.mcc,
    brand,
    certainty: "estimate",
    matchKind: "store_type_estimate",
    displayCategory: categoryForMcc(
      hit.mcc,
      input.mccCatalog,
      brand,
      input.categoryFallback,
    ),
    warnings: [
      ...warnings,
      {
        kind: "certainty",
        message: "Using store-type MCC estimate (no approved brand code)",
      },
    ],
  };
}

export function networkKey(network: CreditCard["network"]): AcceptedNetwork | null {
  if (network === "Visa") return "visa";
  if (network === "Mastercard") return "mastercard";
  if (network === "Amex") return "amex";
  return null;
}

/**
 * Resolve the purchase MCC: approved store code → store-type estimate →
 * user-picked category → unknown (base rate).
 */
function resolveAfterBrand(
  brand: MerchantBrand | null,
  input: ResolveInput,
  warnings: RecommendationWarning[],
): ResolvedStoreCode {
  const explicitMcc = input.store?.mcc ?? input.mcc ?? null;
  if (explicitMcc) {
    return resolveFromExplicitMcc(explicitMcc, brand, input, warnings);
  }

  const osmTag = input.store?.osmTag;
  if (osmTag) {
    const fromOsm = resolveFromOsmTag(osmTag, brand, input, warnings);
    if (fromOsm) return fromOsm;
  }

  if (input.categoryFallback) {
    return {
      mcc: null,
      brand,
      certainty: "unknown",
      matchKind: "user_category",
      displayCategory: input.categoryFallback,
      warnings: [
        ...warnings,
        {
          kind: "user_chosen_category",
          message: `No store code — using category ${CATEGORY_LABELS[input.categoryFallback]} as fallback`,
        },
      ],
    };
  }

  return {
    mcc: null,
    brand,
    certainty: "unknown",
    matchKind: "base_rate",
    displayCategory: brand?.category ?? "other",
    warnings,
  };
}

function resolveFromKnownBrand(
  brand: MerchantBrand,
  forNetwork: CreditCard["network"] | undefined,
  input: ResolveInput,
): ResolvedStoreCode {
  const code = forNetwork
    ? brandMccForNetwork(brand, forNetwork)
    : (brand.mcc ?? null);
  const certainty = brand.certainty ?? (code ? "confirmed" : "unknown");
  const warnings = [...certaintyWarnings(certainty, code)];
  if (!code) {
    return resolveAfterBrand(brand, input, warnings);
  }
  return {
    mcc: code,
    brand,
    certainty,
    matchKind: "named_merchant",
    displayCategory: brand.category,
    warnings,
  };
}

export function resolveStoreCode(
  input: ResolveInput,
  forNetwork?: CreditCard["network"],
): ResolvedStoreCode {
  const brand = findBrand(input);
  if (brand) {
    return resolveFromKnownBrand(brand, forNetwork, input);
  }
  return resolveAfterBrand(null, input, []);
}
