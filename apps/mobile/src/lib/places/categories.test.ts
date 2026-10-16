import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../api-types";
import {
  MCC_DISPLAY_CATEGORIES,
  OSM_PLACE_KEYS,
  OSM_TAG_MCCS,
  categoryForPlaceType,
  classifyOsmTags,
  displayCategoryForMcc,
  formatOsmTag,
} from "./categories";

describe("OSM_TAG_MCCS", () => {
  it("maps every tag to a 4-digit MCC whose display group is a known category", () => {
    const known = new Set<string>(CATEGORIES);
    for (const key of OSM_PLACE_KEYS) {
      for (const [value, entry] of Object.entries(OSM_TAG_MCCS[key])) {
        expect(entry.mcc, `${key}=${value}`).toMatch(/^\d{4}$/);
        const category = displayCategoryForMcc(entry.mcc);
        expect(known.has(category), `${key}=${value} → ${entry.mcc} → ${category}`).toBe(
          true,
        );
      }
    }
  });

  it("gives a tag value the same MCC under every key it appears in", () => {
    const seen = new Map<string, string>();
    for (const key of OSM_PLACE_KEYS) {
      for (const [value, entry] of Object.entries(OSM_TAG_MCCS[key])) {
        const prior = seen.get(value);
        if (prior) expect(entry.mcc, value).toBe(prior);
        seen.set(value, entry.mcc);
      }
    }
  });

  it("only uses tag values safe to embed in an Overpass regex", () => {
    for (const key of OSM_PLACE_KEYS) {
      for (const value of Object.keys(OSM_TAG_MCCS[key])) {
        expect(value).toMatch(/^[a-z_]+$/);
      }
    }
  });

  it("marks only gas / grocery / drugstore tags as priority", () => {
    const priority = new Set<string>();
    for (const key of OSM_PLACE_KEYS) {
      for (const [value, entry] of Object.entries(OSM_TAG_MCCS[key])) {
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
  it("prefers amenity, then shop, tourism and railway, and exposes osmTag + MCC", () => {
    expect(classifyOsmTags({ amenity: "fuel", shop: "convenience" })).toEqual({
      placeType: "fuel",
      osmTag: "amenity=fuel",
      mcc: "5541",
      certainty: "estimate",
      category: "gas",
    });
    expect(classifyOsmTags({ amenity: "parking", shop: "hardware" })).toEqual({
      placeType: "hardware",
      osmTag: "shop=hardware",
      mcc: "5251",
      certainty: "estimate",
      category: "other",
    });
    expect(classifyOsmTags({ tourism: "motel" })).toMatchObject({
      osmTag: "tourism=motel",
      mcc: "7011",
      certainty: "estimate",
      category: "travel",
    });
    expect(classifyOsmTags({ railway: "station" })).toMatchObject({
      osmTag: "railway=station",
      certainty: "estimate",
      category: "transit",
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
    expect(categoryForPlaceType("toString")).toBe("other");
    expect(categoryForPlaceType(undefined)).toBe("other");
  });
});
