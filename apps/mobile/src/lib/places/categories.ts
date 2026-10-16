import type { Category, MccCertainty } from "../api-types";

/** OSM keys the nearby lookup queries, in precedence order for tagging a place. */
export const OSM_PLACE_KEYS = ["amenity", "shop", "tourism", "railway"] as const;

export type OsmPlaceKey = (typeof OSM_PLACE_KEYS)[number];

/**
 * Tags the nearby Overpass query asks for. `priority: true` means the tag is
 * never truncated by the secondary result cap (gas / grocery / drugstore).
 * MCC estimates live in {@link STORE_TYPE_MCC_BY_TAG}, not here.
 */
export const OSM_PLACE_TAGS: Record<
  OsmPlaceKey,
  Record<string, { priority?: boolean }>
> = {
  amenity: {
    fuel: { priority: true },
    pharmacy: { priority: true },
    restaurant: {},
    fast_food: {},
    cafe: {},
    bar: {},
    pub: {},
    biergarten: {},
    food_court: {},
    ice_cream: {},
    cinema: {},
    theatre: {},
    nightclub: {},
    bus_station: {},
    ferry_terminal: {},
    car_rental: {},
  },
  shop: {
    supermarket: { priority: true },
    convenience: { priority: true },
    wholesale: {},
    greengrocer: {},
    butcher: {},
    bakery: {},
    deli: {},
    chemist: { priority: true },
    pharmacy: { priority: true },
    department_store: {},
    variety_store: {},
    hardware: {},
    doityourself: {},
    paint: {},
    garden_centre: {},
    furniture: {},
    mall: {},
    electronics: {},
    computer: {},
    mobile_phone: {},
    clothes: {},
    shoes: {},
    sports: {},
    outdoor: {},
    books: {},
    toys: {},
    gift: {},
    jewelry: {},
    pet: {},
    alcohol: {},
  },
  tourism: {
    hotel: {},
    motel: {},
    hostel: {},
    guest_house: {},
    museum: {},
    zoo: {},
    aquarium: {},
    theme_park: {},
  },
  railway: {
    station: {},
  },
};

/**
 * Store-type MCC estimates keyed by full OSM tag (`shop=convenience`).
 * Mirrors approved `store_type_mccs` / API `STORE_TYPE_MCCS`. Brand / approved
 * store codes override this on the API; the app sends `merchantQuery` +
 * `osmTag` + amount (not `mcc`).
 */
export const STORE_TYPE_MCC_BY_TAG: Readonly<Record<string, string>> = {
  "amenity=fuel": "5541",
  "amenity=pharmacy": "5912",
  "amenity=restaurant": "5812",
  "amenity=fast_food": "5814",
  "amenity=cafe": "5814",
  "amenity=bar": "5813",
  "amenity=pub": "5813",
  "amenity=biergarten": "5813",
  "amenity=food_court": "5814",
  "amenity=ice_cream": "5814",
  "amenity=cinema": "7832",
  "amenity=theatre": "7922",
  "amenity=nightclub": "5813",
  "amenity=bus_station": "4131",
  "amenity=ferry_terminal": "4111",
  "amenity=car_rental": "7512",
  "shop=supermarket": "5411",
  // Convenience terminals almost always post 5499 (misc. food), not grocery 5411.
  "shop=convenience": "5499",
  "shop=wholesale": "5300",
  "shop=greengrocer": "5422",
  "shop=butcher": "5422",
  "shop=bakery": "5462",
  "shop=deli": "5499",
  "shop=chemist": "5912",
  "shop=pharmacy": "5912",
  "shop=department_store": "5311",
  "shop=variety_store": "5331",
  "shop=hardware": "5251",
  "shop=doityourself": "5200",
  "shop=paint": "5231",
  "shop=garden_centre": "5261",
  "shop=furniture": "5712",
  "shop=mall": "5310",
  "shop=electronics": "5732",
  "shop=computer": "5734",
  "shop=mobile_phone": "4812",
  "shop=clothes": "5651",
  "shop=shoes": "5661",
  "shop=sports": "5941",
  "shop=outdoor": "5941",
  "shop=books": "5942",
  "shop=toys": "5945",
  "shop=gift": "5947",
  "shop=jewelry": "5944",
  "shop=pet": "5995",
  "shop=alcohol": "5921",
  "tourism=hotel": "7011",
  "tourism=motel": "7011",
  "tourism=hostel": "7011",
  "tourism=guest_house": "7011",
  "tourism=museum": "7991",
  "tourism=zoo": "7998",
  "tourism=aquarium": "7998",
  "tourism=theme_park": "7996",
  "railway=station": "4111",
};

/**
 * MCC → DS4 display group. Mirrors approved `category_mccs` for codes the
 * store-type table uses. Unknown codes fall through to "other".
 */
export const MCC_DISPLAY_CATEGORIES: Readonly<Record<string, Category>> = {
  "5411": "groceries",
  "5422": "groceries",
  "5441": "groceries",
  "5451": "groceries",
  "5462": "groceries",
  "5499": "other",
  "5812": "dining",
  "5813": "dining",
  "5814": "dining",
  "5541": "gas",
  "5542": "gas",
  "4111": "transit",
  "4121": "transit",
  "4131": "transit",
  "5912": "drugstore",
  "4814": "recurring_bills",
  "4900": "recurring_bills",
  "3000": "travel",
  "4511": "travel",
  "7011": "travel",
  "7512": "travel",
  "7832": "entertainment",
  "7922": "entertainment",
  "7991": "entertainment",
  "7996": "entertainment",
  "7998": "entertainment",
  "5300": "other",
  "5310": "other",
  "5311": "other",
  "5331": "other",
  "5200": "other",
  "5231": "other",
  "5251": "other",
  "5261": "other",
  "5712": "other",
  "5732": "other",
  "5734": "other",
  "4812": "other",
  "5651": "other",
  "5661": "other",
  "5941": "other",
  "5942": "other",
  "5944": "other",
  "5945": "other",
  "5947": "other",
  "5995": "other",
  "5921": "other",
};

export function displayCategoryForMcc(mcc: string | null | undefined): Category {
  if (!mcc) return "other";
  return MCC_DISPLAY_CATEGORIES[mcc] ?? "other";
}

export function formatOsmTag(key: OsmPlaceKey, value: string): string {
  return `${key}=${value}`;
}

export function mccForOsmTag(osmTag: string | undefined): string | null {
  if (!osmTag) return null;
  return STORE_TYPE_MCC_BY_TAG[osmTag] ?? null;
}

export interface PlaceClassification {
  /** The matched OSM tag value, e.g. "fuel" or "hotel". */
  placeType: string;
  /** Full OSM tag for API store-type fallback, e.g. "amenity=fuel". */
  osmTag: string;
  /** Store-type MCC estimate, or null when the tag has no store_type row. */
  mcc: string | null;
  /** `estimate` when a store-type MCC exists; otherwise `unknown`. */
  certainty: Extract<MccCertainty, "estimate" | "unknown">;
}

function lookupTag(
  key: OsmPlaceKey,
  value: string,
): { priority?: boolean } | undefined {
  const table = OSM_PLACE_TAGS[key];
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : undefined;
}

/**
 * First requested OSM tag on a place (amenity, then shop, …) plus store-type
 * MCC estimate and confidence. Display category is derived later via
 * {@link displayCategoryForMcc} — not stored here.
 */
export function classifyOsmTags(
  tags: Record<string, string>,
): PlaceClassification | null {
  for (const key of OSM_PLACE_KEYS) {
    const value = tags[key];
    if (!value) continue;
    if (!lookupTag(key, value)) continue;
    const osmTag = formatOsmTag(key, value);
    const mcc = mccForOsmTag(osmTag);
    return {
      placeType: value,
      osmTag,
      mcc,
      certainty: mcc ? "estimate" : "unknown",
    };
  }
  return null;
}

/** Display category for a bare OSM tag value (any key); "other" when unknown. */
export function categoryForPlaceType(placeType: string | undefined): Category {
  if (!placeType) return "other";
  for (const key of OSM_PLACE_KEYS) {
    if (!lookupTag(key, placeType)) continue;
    return displayCategoryForMcc(mccForOsmTag(formatOsmTag(key, placeType)));
  }
  return "other";
}

/** Osm tag string (`shop=supermarket`) for a bare place-type value when known. */
export function osmTagForPlaceType(placeType: string | undefined): string | undefined {
  if (!placeType) return undefined;
  for (const key of OSM_PLACE_KEYS) {
    if (lookupTag(key, placeType)) return formatOsmTag(key, placeType);
  }
  return undefined;
}
