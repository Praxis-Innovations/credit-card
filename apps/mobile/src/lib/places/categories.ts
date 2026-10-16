import type { Category, MccCertainty } from "../api-types";

/** OSM keys the nearby lookup queries, in precedence order for tagging a place. */
export const OSM_PLACE_KEYS = ["amenity", "shop", "tourism", "railway"] as const;

export type OsmPlaceKey = (typeof OSM_PLACE_KEYS)[number];

/**
 * Store-type MCC estimate for an OSM tag (`key=value`), plus whether the tag is
 * priority for the Overpass result cap. Display category is the MCC's DS4 group
 * (via {@link displayCategoryForMcc}) — not a new API category name.
 *
 * Brand / approved store codes override this estimate on the API; the app only
 * sends `merchantQuery` + `osmTag` + amount.
 */
export interface OsmTagMcc {
  mcc: string;
  /** Gas / grocery / drugstore — never truncated by the Overpass secondary cap. */
  priority?: boolean;
}

/**
 * Every OSM tag the nearby lookup requests, mapped to a store-type MCC estimate.
 * One table builds the Overpass query and classifies results.
 */
export const OSM_TAG_MCCS: Record<OsmPlaceKey, Record<string, OsmTagMcc>> = {
  amenity: {
    fuel: { mcc: "5541", priority: true },
    pharmacy: { mcc: "5912", priority: true },
    restaurant: { mcc: "5812" },
    fast_food: { mcc: "5814" },
    cafe: { mcc: "5814" },
    bar: { mcc: "5813" },
    pub: { mcc: "5813" },
    biergarten: { mcc: "5813" },
    food_court: { mcc: "5814" },
    ice_cream: { mcc: "5814" },
    cinema: { mcc: "7832" },
    theatre: { mcc: "7922" },
    nightclub: { mcc: "5813" },
    bus_station: { mcc: "4131" },
    ferry_terminal: { mcc: "4111" },
    car_rental: { mcc: "7512" },
  },
  shop: {
    supermarket: { mcc: "5411", priority: true },
    convenience: { mcc: "5499", priority: true },
    wholesale: { mcc: "5300" },
    greengrocer: { mcc: "5422" },
    butcher: { mcc: "5422" },
    bakery: { mcc: "5462" },
    deli: { mcc: "5499" },
    chemist: { mcc: "5912", priority: true },
    pharmacy: { mcc: "5912", priority: true },
    department_store: { mcc: "5311" },
    variety_store: { mcc: "5331" },
    hardware: { mcc: "5251" },
    doityourself: { mcc: "5200" },
    paint: { mcc: "5231" },
    garden_centre: { mcc: "5261" },
    furniture: { mcc: "5712" },
    mall: { mcc: "5310" },
    electronics: { mcc: "5732" },
    computer: { mcc: "5734" },
    mobile_phone: { mcc: "4812" },
    clothes: { mcc: "5651" },
    shoes: { mcc: "5661" },
    sports: { mcc: "5941" },
    outdoor: { mcc: "5941" },
    books: { mcc: "5942" },
    toys: { mcc: "5945" },
    gift: { mcc: "5947" },
    jewelry: { mcc: "5944" },
    pet: { mcc: "5995" },
    alcohol: { mcc: "5921" },
  },
  tourism: {
    hotel: { mcc: "7011" },
    motel: { mcc: "7011" },
    hostel: { mcc: "7011" },
    guest_house: { mcc: "7011" },
    museum: { mcc: "7991" },
    zoo: { mcc: "7998" },
    aquarium: { mcc: "7998" },
    theme_park: { mcc: "7996" },
  },
  railway: {
    station: { mcc: "4111" },
  },
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

export interface PlaceClassification {
  /** The matched OSM tag value, e.g. "fuel" or "hotel". */
  placeType: string;
  /** Full OSM tag for API store-type fallback, e.g. "amenity=fuel". */
  osmTag: string;
  /** Store-type MCC estimate (brand codes override this on the API). */
  mcc: string;
  /** Always `estimate` for map-tag fallback; brand codes are confirmed on the API. */
  certainty: Extract<MccCertainty, "estimate">;
  /** DS4 display group for the store list. */
  category: Category;
}

function lookup(key: OsmPlaceKey, value: string): OsmTagMcc | undefined {
  const table = OSM_TAG_MCCS[key];
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : undefined;
}

/** First requested OSM tag on a place (amenity, then shop, …) and its MCC. */
export function classifyOsmTags(
  tags: Record<string, string>,
): PlaceClassification | null {
  for (const key of OSM_PLACE_KEYS) {
    const value = tags[key];
    if (!value) continue;
    const entry = lookup(key, value);
    if (!entry) continue;
    return {
      placeType: value,
      osmTag: formatOsmTag(key, value),
      mcc: entry.mcc,
      certainty: "estimate",
      category: displayCategoryForMcc(entry.mcc),
    };
  }
  return null;
}

/** Display category for a bare OSM tag value (any key); "other" when unknown. */
export function categoryForPlaceType(placeType: string | undefined): Category {
  if (!placeType) return "other";
  for (const key of OSM_PLACE_KEYS) {
    const entry = lookup(key, placeType);
    if (entry) return displayCategoryForMcc(entry.mcc);
  }
  return "other";
}

/** Osm tag string (`shop=supermarket`) for a bare place-type value when known. */
export function osmTagForPlaceType(placeType: string | undefined): string | undefined {
  if (!placeType) return undefined;
  for (const key of OSM_PLACE_KEYS) {
    if (lookup(key, placeType)) return formatOsmTag(key, placeType);
  }
  return undefined;
}
