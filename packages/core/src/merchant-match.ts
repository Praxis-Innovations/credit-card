import { MERCHANT_BRANDS } from "./partnerships";
import type { Category, MerchantBrand } from "./schema";

/**
 * Optional context from a places provider (OSM amenity/shop tags, etc.)
 * so Costco Gas can be preferred over Costco Warehouse when at a fuel pump.
 */
export type PlaceMatchContext = {
  /** OSM amenity / shop / craft value when known. */
  placeType?: string;
  /** Extra strings to score (brand, operator, name). */
  tags?: string[];
};

/** Extra aliases beyond the catalog display name (lowercased). */
const BRAND_ALIASES: Record<string, string[]> = {
  shell: ["shell canada", "shell gas"],
  pioneer: ["pioneer gas"],
  ultramar: ["ultramar gas"],
  "fas-gas": ["fasgas", "fas gas plus"],
  "chevron-parkland": ["chevron", "chevron canada"],
  "on-the-run": ["on the run", "otr"],
  "canadian-tire-gas-plus": [
    "canadian tire gas",
    "canadian tire gas+",
    "gas+",
    "ct gas",
  ],
  "petro-canada": ["petro canada", "petro-canada", "petrocan"],
  "costco-gas": ["costco gasoline", "costco gas", "costco fuel"],
  "costco-warehouse": ["costco wholesale", "costco"],
  "costco-ca": ["costco.ca", "costco online"],
  esso: ["esso canada", "imperial oil"],
  mobil: ["mobil gas", "mobil canada"],
  loblaws: ["loblaw", "loblaws city market"],
  "no-frills": ["nofrills", "no frills"],
  "real-canadian-superstore": [
    "real canadian superstore",
    "superstore",
    "rcss",
  ],
  "shoppers-drug-mart": ["shoppers drug mart", "shoppers", "sdm"],
  pharmaprix: ["pharmaprix"],
  sobeys: ["sobey's", "sobeys extra"],
  safeway: ["safeway canada"],
  foodland: ["foodland ontario"],
  freshco: ["freshco"],
  "iga-participating": ["iga"],
  "thrifty-foods": ["thrifty foods", "thriftyfoods"],
  "lawtons-drugs": ["lawtons", "lawton's", "lawtons drugs"],
  metro: ["metro ontario", "metro quebec"],
  "food-basics": ["food basics", "foodbasics"],
  "super-c": ["super c", "superc"],
  "jean-coutu": ["jean coutu", "pjq"],
  brunet: ["brunet"],
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function aliasList(brand: MerchantBrand): string[] {
  const extras = BRAND_ALIASES[brand.id] ?? [];
  const fromName = normalize(brand.name)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  return [normalize(brand.name), fromName, ...extras.map(normalize)].filter(
    Boolean,
  );
}

function isFuelContext(ctx?: PlaceMatchContext): boolean {
  const type = ctx?.placeType?.toLowerCase() ?? "";
  if (type === "fuel" || type === "gas") return true;
  const hay = [ctx?.placeType, ...(ctx?.tags ?? [])]
    .filter(Boolean)
    .map((s) => normalize(String(s)))
    .join(" ");
  return /\b(fuel|gas station|petrol|gasoline)\b/.test(hay);
}

function isWarehouseContext(ctx?: PlaceMatchContext): boolean {
  const type = ctx?.placeType?.toLowerCase() ?? "";
  if (type === "wholesale" || type === "supermarket" || type === "mall") {
    return true;
  }
  const hay = [ctx?.placeType, ...(ctx?.tags ?? [])]
    .filter(Boolean)
    .map((s) => normalize(String(s)))
    .join(" ");
  return /\b(wholesale|warehouse|supermarket)\b/.test(hay);
}

function scoreBrand(
  brand: MerchantBrand,
  haystack: string,
  ctx?: PlaceMatchContext,
): number {
  let best = 0;
  for (const alias of aliasList(brand)) {
    if (!alias) continue;
    if (haystack === alias) {
      best = Math.max(best, 100 + alias.length);
    } else if (haystack.includes(alias)) {
      best = Math.max(best, 80 + alias.length);
    } else if (alias.includes(haystack) && haystack.length >= 4) {
      best = Math.max(best, 50 + haystack.length);
    }
  }

  if (best === 0) return 0;

  // Disambiguate Costco banners using place context.
  if (brand.id === "costco-gas" && isFuelContext(ctx)) best += 40;
  if (brand.id === "costco-warehouse" && isWarehouseContext(ctx) && !isFuelContext(ctx)) {
    best += 40;
  }
  if (brand.id === "costco-gas" && isWarehouseContext(ctx) && !isFuelContext(ctx)) {
    best -= 30;
  }
  if (brand.id === "costco-warehouse" && isFuelContext(ctx)) best -= 30;
  if (brand.id === "costco-ca") best -= 10; // prefer physical banners when ambiguous

  // Prefer Gas+ over generic Canadian Tire when fuel context.
  if (brand.id === "canadian-tire-gas-plus" && isFuelContext(ctx)) best += 20;

  return best;
}

/**
 * Match a free-text place name (and optional OSM tags) to a catalog
 * {@link MerchantBrand}. Returns null when nothing confident matches.
 */
export function matchMerchantBrand(
  query: string,
  context?: PlaceMatchContext,
): MerchantBrand | null {
  const parts = [query, ...(context?.tags ?? [])]
    .filter((p) => typeof p === "string" && p.trim().length > 0)
    .map((p) => normalize(p));
  if (parts.length === 0) return null;

  let best: { brand: MerchantBrand; score: number } | null = null;
  for (const brand of MERCHANT_BRANDS) {
    let score = 0;
    for (const part of parts) {
      score = Math.max(score, scoreBrand(brand, part, context));
    }
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { brand, score };
    }
  }

  // Require a minimum confidence so "Shell" matches but "Coffee Shop" does not.
  if (!best || best.score < 50) return null;
  return best.brand;
}

/**
 * Match many nearby place names; returns the closest confident brand hit
 * when callers pass places already sorted by distance.
 */
export function matchNearestMerchantBrand(
  places: Array<{ name: string; context?: PlaceMatchContext }>,
): MerchantBrand | null {
  for (const place of places) {
    const hit = matchMerchantBrand(place.name, place.context);
    if (hit) return hit;
  }
  return null;
}

export function brandsForCategory(category: Category): MerchantBrand[] {
  return MERCHANT_BRANDS.filter((b) => b.category === category);
}
