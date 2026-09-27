import type { Category, MerchantBrand } from "./api-types";
import type { NearbyPlace } from "./places";

/** A store the user can pick: an OSM place, a catalog brand, or free text. */
export interface StoreChoice {
  /** Display name. */
  name: string;
  /** Raw text sent as merchantQuery — the API resolves it to a brand. */
  merchantQuery?: string;
  /** Category sent with the request; the API overrides it when the brand resolves. */
  category: Category;
  logoUrl: string | null;
  logoAlt: string | null;
  distanceMeters?: number;
  /** Matches a brand in /v1/merchant-brands (i.e. has a card partnership). */
  partner: boolean;
  source: "nearby" | "browse" | "search" | "category";
}

/** Tile shown in the Nearby grid. */
export interface NearbyStore {
  id: string;
  name: string;
  merchantQuery: string;
  category: Category;
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

const OSM_CATEGORY: Record<string, Category> = {
  fuel: "gas",
  supermarket: "groceries",
  convenience: "groceries",
  wholesale: "groceries",
  greengrocer: "groceries",
  chemist: "drugstore",
  pharmacy: "drugstore",
  restaurant: "dining",
  cafe: "dining",
  fast_food: "dining",
  bar: "dining",
  pub: "dining",
};

/** Spend category for an OSM amenity/shop value; "other" when unknown. */
export function categoryForPlaceType(placeType: string | undefined): Category {
  return (placeType && OSM_CATEGORY[placeType]) || "other";
}

/**
 * Find the catalog brand for an OSM place by name/brand tags. Only drives the
 * partner dot and logo — the API does the authoritative match from
 * merchantQuery. Exact normalized match wins; otherwise a whole-word prefix
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
    const category = categoryForPlaceType(place.placeType);
    const hints = [...place.brandHints, name];
    const brand = matchBrand(hints, brands, category);
    const merchantQuery =
      place.brandHints.find((h) => h.trim().length > 0)?.trim() || name;
    stores.push({
      id: place.id,
      name,
      merchantQuery,
      category,
      distanceMeters: place.distanceMeters,
      brand,
    });
    if (stores.length >= limit) break;
  }
  return stores;
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
