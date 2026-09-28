import { describe, expect, it } from "vitest";
import type { MerchantBrand } from "./api-types";
import type { NearbyPlace } from "./places";
import {
  categoryForPlaceType,
  formatDistance,
  matchBrand,
  normalizeName,
  orderCategories,
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
  it("maps OSM types to spend categories", () => {
    expect(categoryForPlaceType("fuel")).toBe("gas");
    expect(categoryForPlaceType("supermarket")).toBe("groceries");
    expect(categoryForPlaceType("pharmacy")).toBe("drugstore");
    expect(categoryForPlaceType("cafe")).toBe("dining");
    expect(categoryForPlaceType("mall")).toBe("other");
    expect(categoryForPlaceType(undefined)).toBe("other");
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
      ["3", "Harbord Convenience", "groceries", null],
    ]);
  });

  it("sends the OSM brand tag as merchantQuery when present", () => {
    const [store] = toNearbyStores(
      [place("1", "Shoppers Drug Mart Bloor", 50, { brandHints: ["Shoppers Drug Mart"] })],
      BRANDS,
    );
    expect(store?.merchantQuery).toBe("Shoppers Drug Mart");
    expect(store?.brand?.id).toBe("shoppers-drug-mart");
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
