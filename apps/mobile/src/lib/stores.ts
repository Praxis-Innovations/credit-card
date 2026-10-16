import { CATEGORY_LABELS, type Category, type MerchantBrand } from "./api-types";
import {
  categoryForPlaceType,
  displayCategoryForMcc,
  osmTagForPlaceType,
  type NearbyPlace,
} from "./places";

export { categoryForPlaceType, osmTagForPlaceType };

/** A store the user picked: an OSM place, a catalog brand, a search, or a bare category. */
export interface StoreChoice {
  /** Display name (also sent as `merchantQuery` except for bare categories). */
  name: string;
  /**
   * DS4 display group for UI (from brand category or store-type MCC group).
   * Not sent as the ranking key — the API resolves MCC from the store.
   */
  category: Category;
  /** OSM tag for store-type MCC fallback, e.g. `shop=supermarket`. */
  osmTag?: string;
  logoUrl: string | null;
  logoAlt: string | null;
  distanceMeters?: number;
  source: "nearby" | "browse" | "search" | "category";
}

/** Tile shown in the Nearby grid. */
export interface NearbyStore {
  id: string;
  name: string;
  category: Category;
  osmTag?: string;
  distanceMeters: number;
  brand: MerchantBrand | null;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/**
 * Display category for a picked store: catalog brand first (approved store
 * code's display group), else the place's MCC display group, else Browse, else
 * "other".
 */
export function storeCategory(input: {
  brand?: Pick<MerchantBrand, "category"> | null;
  /** Store-type MCC estimate; display group comes from the MCC catalog. */
  mcc?: string | null;
  placeType?: string;
  browseCategory?: Category;
}): Category {
  if (input.brand) return input.brand.category;
  const fromMcc = input.mcc
    ? displayCategoryForMcc(input.mcc)
    : categoryForPlaceType(input.placeType);
  if (fromMcc !== "other") return fromMcc;
  return input.browseCategory ?? "other";
}

/**
 * Find the catalog brand for an OSM place by name/brand tags (drives the logo
 * and category). Exact normalized match wins; otherwise a whole-word prefix
 * ("Costco" ↔ "Costco Gas"), preferring a brand in the place's category.
 */
export function matchBrand(
  hints: string[],
  brands: MerchantBrand[],
  category?: Category,
): MerchantBrand | null {
  const normalizedHints = hints.map(normalizeName).filter(Boolean);
  if (normalizedHints.length === 0 || brands.length === 0) return null;
  const candidates = brands.map((b) => ({ brand: b, key: normalizeName(b.name) }));

  for (const hint of normalizedHints) {
    const exact = candidates.find((c) => c.key === hint);
    if (exact) return exact.brand;
  }

  const prefixMatches = candidates.filter((c) =>
    normalizedHints.some(
      (hint) => c.key.startsWith(`${hint} `) || hint.startsWith(`${c.key} `),
    ),
  );
  if (prefixMatches.length === 0) return null;
  const sameCategory = category
    ? prefixMatches.find((c) => c.brand.category === category)
    : undefined;
  return (sameCategory ?? prefixMatches[0]!).brand;
}

/**
 * Turn raw Overpass places into tiles: one per name (nearest wins), capped,
 * annotated with the matching catalog brand. Shows only what the lookup
 * returned — nothing is added.
 */
export function toNearbyStores(
  places: NearbyPlace[],
  brands: MerchantBrand[],
  limit = 12,
): NearbyStore[] {
  const seen = new Set<string>();
  const stores: NearbyStore[] = [];
  const sorted = [...places].sort((a, b) => a.distanceMeters - b.distanceMeters);
  for (const place of sorted) {
    const name = place.name.trim();
    if (!name) continue;
    const key = normalizeName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const osmTag = place.osmTag ?? osmTagForPlaceType(place.placeType);
    const placeCategory = storeCategory({
      mcc: place.mcc,
      placeType: place.placeType,
    });
    const brand = matchBrand([...place.brandHints, name], brands, placeCategory);
    stores.push({
      id: place.id,
      name,
      category: storeCategory({ brand, mcc: place.mcc, placeType: place.placeType }),
      osmTag,
      distanceMeters: place.distanceMeters,
      brand,
    });
    if (stores.length >= limit) break;
  }
  return stores;
}

export function choiceFromNearby(store: NearbyStore): StoreChoice {
  return {
    name: store.name,
    category: store.category,
    osmTag: store.osmTag,
    logoUrl: store.brand?.logoUrl ?? null,
    logoAlt: store.brand?.logoAlt ?? null,
    distanceMeters: store.distanceMeters,
    source: "nearby",
  };
}

export function choiceFromBrand(brand: MerchantBrand): StoreChoice {
  return {
    name: brand.name,
    category: storeCategory({ brand }),
    logoUrl: brand.logoUrl ?? null,
    logoAlt: brand.logoAlt ?? null,
    source: "browse",
  };
}

/** "Not listed? Use Gas rates": the category itself stands in for the store. */
export function choiceForCategory(category: Category): StoreChoice {
  return {
    name: CATEGORY_LABELS[category],
    category,
    logoUrl: null,
    logoAlt: null,
    source: "category",
  };
}

/** Free-text store from the search box, priced at the selected Browse category. */
export function choiceFromSearch(text: string, browseCategory: Category): StoreChoice {
  return {
    name: text.trim(),
    category: storeCategory({ browseCategory }),
    logoUrl: null,
    logoAlt: null,
    source: "search",
  };
}

export function formatDistance(meters: number): string {
  if (meters < 100) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Chip order for Browse. The set always comes from GET /v1/categories;
 * this only orders the ones the design leads with.
 */
export const CATEGORY_CHIP_ORDER: Category[] = [
  "gas",
  "groceries",
  "dining",
  "drugstore",
  "travel",
  "other",
];

export function orderCategories<T extends { id: Category }>(list: T[]): T[] {
  const rank = (id: Category) => {
    const i = CATEGORY_CHIP_ORDER.indexOf(id);
    return i === -1 ? CATEGORY_CHIP_ORDER.length : i;
  };
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.index - b.index)
    .map(({ item }) => item);
}
