import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../api-types";
import {
  MCC_DISPLAY_CATEGORIES,
  OSM_PLACE_KEYS,
  OSM_PLACE_TAGS,
  STORE_TYPE_MCC_BY_TAG,
  categoryForPlaceType,
  classifyOsmTags,
  displayCategoryForMcc,
  formatOsmTag,
  mccForOsmTag,
} from "./categories";

describe("OSM_PLACE_TAGS", () => {
  it("only lists tags to query (and optional priority), not categories", () => {
    for (const key of OSM_PLACE_KEYS) {
      for (const [value, entry] of Object.entries(OSM_PLACE_TAGS[key])) {
        expect(value).toMatch(/^[a-z_]+$/);
        expect(Object.keys(entry).every((k) => k === "priority")).toBe(true);
      }
    }
  });

  it("marks only gas / grocery / drugstore tags as priority", () => {
    const priority = new Set<string>();
    for (const key of OSM_PLACE_KEYS) {
      for (const [value, entry] of Object.entries(OSM_PLACE_TAGS[key])) {
        if (entry.priority) priority.add(formatOsmTag(key, value));
      }
    }
    expect([...priority].sort()).toEqual([
      "amenity=fuel",
      "amenity=pharmacy",
      "shop=chemist",
      "shop=convenience",
      "shop=pharmacy",
      "shop=supermarket",
    ]);
  });

  it("has a store-type MCC estimate for every queried tag", () => {
    for (const key of OSM_PLACE_KEYS) {
      for (const value of Object.keys(OSM_PLACE_TAGS[key])) {
        const osmTag = formatOsmTag(key, value);
        expect(STORE_TYPE_MCC_BY_TAG[osmTag], osmTag).toMatch(/^\d{4}$/);
      }
    }
  });
});

describe("STORE_TYPE_MCC_BY_TAG", () => {
  it("matches the API catalog for convenience (5499, not groceries)", () => {
    expect(mccForOsmTag("shop=convenience")).toBe("5499");
    expect(displayCategoryForMcc("5499")).toBe("other");
  });
});

describe("MCC_DISPLAY_CATEGORIES", () => {
  it("only lists DS4 categories", () => {
    const known = new Set<string>(CATEGORIES);
    for (const [mcc, category] of Object.entries(MCC_DISPLAY_CATEGORIES)) {
      expect(mcc).toMatch(/^\d{4}$/);
      expect(known.has(category), `${mcc} → ${category}`).toBe(true);
    }
  });
});

describe("classifyOsmTags", () => {
  it("prefers amenity, then shop, tourism and railway; carries osmTag + MCC + confidence", () => {
    expect(classifyOsmTags({ amenity: "fuel", shop: "convenience" })).toEqual({
      placeType: "fuel",
      osmTag: "amenity=fuel",
      mcc: "5541",
      certainty: "estimate",
    });
    expect(classifyOsmTags({ amenity: "parking", shop: "hardware" })).toEqual({
      placeType: "hardware",
      osmTag: "shop=hardware",
      mcc: "5251",
      certainty: "estimate",
    });
    expect(classifyOsmTags({ tourism: "motel" })).toMatchObject({
      osmTag: "tourism=motel",
      mcc: "7011",
      certainty: "estimate",
    });
    expect(classifyOsmTags({ railway: "station" })).toMatchObject({
      osmTag: "railway=station",
      certainty: "estimate",
    });
  });

  it("returns null for tags outside the lookup", () => {
    expect(classifyOsmTags({ amenity: "bank" })).toBeNull();
    expect(classifyOsmTags({ shop: "constructor" })).toBeNull();
    expect(classifyOsmTags({})).toBeNull();
  });
});

describe("categoryForPlaceType", () => {
  it("maps a bare tag value via its store-type MCC display group", () => {
    expect(categoryForPlaceType("department_store")).toBe("other");
    expect(categoryForPlaceType("doityourself")).toBe("other");
    expect(categoryForPlaceType("hotel")).toBe("travel");
    expect(categoryForPlaceType("convenience")).toBe("other");
    expect(categoryForPlaceType("toString")).toBe("other");
    expect(categoryForPlaceType(undefined)).toBe("other");
  });
});
