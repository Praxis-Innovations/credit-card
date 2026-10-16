import { describe, expect, it } from "vitest";
import type { MerchantBrand } from "./api-types";
import type { NearbyPlace } from "./places";
import {
  categoryForPlaceType,
  choiceForCategory,
  choiceFromBrand,
  choiceFromNearby,
  choiceFromSearch,
  formatDistance,
  matchBrand,
  normalizeName,
  orderCategories,
  storeCategory,
  toNearbyStores,
} from "./stores";

function brand(id: string, name: string, category: MerchantBrand["category"]): MerchantBrand {
  return {
    id,
    name,
    category,
    operator: null,
    notes: null,
    sourceUrl: "https://example.test",
    lastVerified: "2026-09-22",
    logoUrl: null,
    logoAlt: null,
  } as MerchantBrand;
}

function place(
  id: string,
  name: string,
  distanceMeters: number,
  extra: Partial<NearbyPlace> = {},
): NearbyPlace {
  return {
    id,
    name,
    latitude: 0,
    longitude: 0,
    distanceMeters,
    brandHints: [],
    rawTags: {},
    ...extra,
  };
}

const BRANDS = [
  brand("shell", "Shell", "gas"),
  brand("costco", "Costco", "groceries"),
  brand("costco-gas", "Costco Gas", "gas"),
  brand("shoppers-drug-mart", "Shoppers Drug Mart", "drugstore"),
];

describe("normalizeName", () => {
  it("lowercases, drops parentheticals and punctuation", () => {
    expect(normalizeName("Shoppers Drug Mart (Yonge)")).toBe("shoppers drug mart");
    expect(normalizeName("A&W")).toBe("a and w");
    expect(normalizeName("Petro-Canada")).toBe("petro canada");
  });
});

describe("categoryForPlaceType", () => {
  it("maps OSM types via store-type MCC display groups", () => {
    expect(categoryForPlaceType("fuel")).toBe("gas");
    expect(categoryForPlaceType("supermarket")).toBe("groceries");
    expect(categoryForPlaceType("pharmacy")).toBe("drugstore");
    expect(categoryForPlaceType("cafe")).toBe("dining");
    expect(categoryForPlaceType("fast_food")).toBe("dining");
    expect(categoryForPlaceType("hotel")).toBe("travel");
    expect(categoryForPlaceType("department_store")).toBe("other");
    expect(categoryForPlaceType("doityourself")).toBe("other");
    expect(categoryForPlaceType("cinema")).toBe("entertainment");
    expect(categoryForPlaceType("electronics")).toBe("other");
    expect(categoryForPlaceType("mall")).toBe("other");
    expect(categoryForPlaceType("convenience")).toBe("other");
    expect(categoryForPlaceType(undefined)).toBe("other");
  });
});

describe("storeCategory", () => {
  it("uses the catalog brand's category first (approved store code)", () => {
    expect(storeCategory({ brand: { category: "gas" } })).toBe("gas");
    expect(
      storeCategory({ brand: { category: "groceries" }, placeType: "fuel", browseCategory: "dining" }),
    ).toBe("groceries");
  });

  it("falls back to the store-type MCC display group, then the Browse category", () => {
    expect(storeCategory({ brand: null, placeType: "pharmacy" })).toBe("drugstore");
    expect(storeCategory({ placeType: "fuel", browseCategory: "dining" })).toBe("gas");
    expect(storeCategory({ placeType: "mall", browseCategory: "travel" })).toBe("travel");
    expect(storeCategory({ browseCategory: "groceries" })).toBe("groceries");
  });

  it("prefers the provider's place category over the tag lookup", () => {
    expect(storeCategory({ placeCategory: "dining", placeType: "fuel" })).toBe("dining");
    expect(storeCategory({ placeCategory: "other", browseCategory: "dining" })).toBe("dining");
  });

  it("is 'other' when nothing says otherwise", () => {
    expect(storeCategory({})).toBe("other");
    expect(storeCategory({ placeType: "mall" })).toBe("other");
  });
});

describe("store choices", () => {
  it("nearby: the matched brand's category and logo, else the MCC display group", () => {
    const [shell, corner] = toNearbyStores(
      [
        place("1", "Shell", 200, {
          placeType: "fuel",
          osmTag: "amenity=fuel",
          brandHints: ["Shell"],
        }),
        place("2", "Harbord Convenience", 300, {
          placeType: "convenience",
          osmTag: "shop=convenience",
        }),
      ],
      [{ ...BRANDS[0]!, logoUrl: "/assets/brands/shell.png", logoAlt: "Shell logo" }],
    );
    expect(choiceFromNearby(shell!)).toEqual({
      name: "Shell",
      category: "gas",
      osmTag: "amenity=fuel",
      logoUrl: "/assets/brands/shell.png",
      logoAlt: "Shell logo",
      distanceMeters: 200,
      source: "nearby",
    });
    expect(choiceFromNearby(corner!)).toMatchObject({
      category: "other",
      osmTag: "shop=convenience",
      logoUrl: null,
    });
  });

  it("a nearby place's brand category wins over its OSM tag", () => {
    const [store] = toNearbyStores(
      [place("1", "Shoppers Drug Mart", 50, { placeType: "convenience" })],
      BRANDS,
    );
    expect(choiceFromNearby(store!).category).toBe("drugstore");
  });

  it("browse brand, bare category and free-text search", () => {
    expect(choiceFromBrand(BRANDS[2]!)).toMatchObject({
      name: "Costco Gas",
      category: "gas",
      source: "browse",
    });
    expect(choiceForCategory("dining")).toMatchObject({
      name: "Dining",
      category: "dining",
      source: "category",
    });
    expect(choiceFromSearch("  Joe's Diner ", "dining")).toMatchObject({
      name: "Joe's Diner",
      category: "dining",
      source: "search",
    });
  });

  it("carries osmTag for nearby places so the API can resolve store-type MCC", () => {
    const [store] = toNearbyStores(
      [place("1", "The Keg", 40, { placeType: "restaurant", osmTag: "amenity=restaurant" })],
      BRANDS,
    );
    expect(choiceFromNearby(store!).osmTag).toBe("amenity=restaurant");
    expect(choiceFromBrand(BRANDS[0]!).osmTag).toBeUndefined();
    expect(choiceForCategory("gas").osmTag).toBeUndefined();
  });
});

describe("matchBrand", () => {
  it("prefers an exact normalized match", () => {
    expect(matchBrand(["SHELL"], BRANDS)?.id).toBe("shell");
    expect(matchBrand(["Costco"], BRANDS, "gas")?.id).toBe("costco");
  });

  it("falls back to a whole-word prefix, preferring the place's category", () => {
    expect(matchBrand(["Costco Wholesale"], BRANDS, "groceries")?.id).toBe("costco");
    expect(matchBrand(["Costco Gas Bar"], BRANDS, "gas")?.id).toBe("costco-gas");
  });

  it("does not match partial words or unknown stores", () => {
    expect(matchBrand(["Shellfish Market"], BRANDS)).toBeNull();
    expect(matchBrand(["Harbord Convenience"], BRANDS)).toBeNull();
    expect(matchBrand([], BRANDS)).toBeNull();
  });
});

describe("toNearbyStores", () => {
  it("keeps only returned places, nearest first, one per name, with brand matches", () => {
    const stores = toNearbyStores(
      [
        place("3", "Harbord Convenience", 300, { placeType: "convenience" }),
        place("1", "Shell", 120, { placeType: "fuel", brandHints: ["Shell"] }),
        place("2", "Shell", 80, { placeType: "fuel", brandHints: ["Shell"] }),
        place("4", "  ", 10),
      ],
      BRANDS,
    );
    expect(stores.map((s) => [s.id, s.name, s.category, s.brand?.id ?? null])).toEqual([
      ["2", "Shell", "gas", "shell"],
      ["3", "Harbord Convenience", "other", null],
    ]);
  });

  it("matches the brand from the OSM brand tag", () => {
    const [store] = toNearbyStores(
      [place("1", "Shoppers Drug Mart Bloor", 50, { brandHints: ["Shoppers Drug Mart"] })],
      BRANDS,
    );
    expect(store?.brand?.id).toBe("shoppers-drug-mart");
    expect(store?.category).toBe("drugstore");
  });

  it("uses the provider's MCC display category for expanded store types", () => {
    const stores = toNearbyStores(
      [
        place("1", "The Keg", 40, {
          placeType: "restaurant",
          osmTag: "amenity=restaurant",
          category: "dining",
        }),
        place("2", "Home Depot", 90, {
          placeType: "doityourself",
          osmTag: "shop=doityourself",
          category: "other",
        }),
        place("3", "Hudson's Bay", 150, {
          placeType: "department_store",
          osmTag: "shop=department_store",
          category: "other",
        }),
        place("4", "Best Buy", 200, {
          placeType: "electronics",
          osmTag: "shop=electronics",
          category: "other",
        }),
      ],
      BRANDS,
    );
    expect(stores.map((s) => [s.name, s.category, s.osmTag])).toEqual([
      ["The Keg", "dining", "amenity=restaurant"],
      ["Home Depot", "other", "shop=doityourself"],
      ["Hudson's Bay", "other", "shop=department_store"],
      ["Best Buy", "other", "shop=electronics"],
    ]);
  });

  it("caps the list", () => {
    const places = Array.from({ length: 20 }, (_, i) => place(String(i), `Store ${i}`, i * 10));
    expect(toNearbyStores(places, BRANDS, 5)).toHaveLength(5);
  });
});

describe("formatDistance", () => {
  it("uses metres under 100 m, km above", () => {
    expect(formatDistance(4)).toBe("10 m");
    expect(formatDistance(64)).toBe("60 m");
    expect(formatDistance(450)).toBe("0.5 km");
    expect(formatDistance(1234)).toBe("1.2 km");
  });
});

describe("orderCategories", () => {
  it("leads with the design order and keeps unknown ones stable at the end", () => {
    const ordered = orderCategories([
      { id: "other" as const },
      { id: "travel" as const },
      { id: "groceries" as const },
      { id: "gas" as const },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["gas", "groceries", "travel", "other"]);
  });
});
