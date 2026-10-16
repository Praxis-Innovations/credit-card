import { describe, expect, it, vi } from "vitest";
import { buildOverpassQuery, createOverpassPlacesProvider } from "./overpass";

function stubFetch(payload: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    json: async () => payload,
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function sentQuery(fetchImpl: ReturnType<typeof vi.fn>): string {
  const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
  return decodeURIComponent(String(init.body).replace(/^data=/, ""));
}

describe("createOverpassPlacesProvider", () => {
  it("parses Overpass fuel nodes into NearbyPlace[] sorted by distance", async () => {
    const payload = {
      elements: [
        {
          type: "node",
          id: 1,
          lat: 43.65,
          lon: -79.38,
          tags: { amenity: "fuel", name: "Shell", brand: "Shell" },
        },
        {
          type: "node",
          id: 2,
          lat: 43.651,
          lon: -79.381,
          tags: { amenity: "fuel", name: "Esso", brand: "Esso" },
        },
        {
          type: "way",
          id: 3,
          center: { lat: 43.649, lon: -79.379 },
          tags: { shop: "supermarket", name: "Loblaws" },
        },
      ],
    };

    const fetchImpl = stubFetch(payload);
    const provider = createOverpassPlacesProvider({ fetchImpl });
    const places = await provider.findNearby(
      { latitude: 43.65, longitude: -79.38 },
      { radiusMeters: 500 },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(places[0]?.name).toBe("Shell");
    expect(places[0]?.placeType).toBe("fuel");
    expect(places[0]?.osmTag).toBe("amenity=fuel");
    expect(places[0]?.mcc).toBe("5541");
    expect(places[0]?.certainty).toBe("estimate");
    expect(places[0]?.category).toBe("gas");
    expect(places[0]?.brandHints).toContain("Shell");
    expect(places.find((p) => p.name === "Loblaws")).toMatchObject({
      osmTag: "shop=supermarket",
      mcc: "5411",
      category: "groceries",
    });
    expect(places.map((p) => p.distanceMeters)).toEqual(
      [...places.map((p) => p.distanceMeters)].sort((a, b) => a - b),
    );
  });

  it("maps restaurants, hotels, department, hardware, electronics and transit via MCC", async () => {
    const tagged: Record<string, string>[] = [
      { amenity: "restaurant", name: "The Keg" },
      { amenity: "fast_food", name: "Tim Hortons" },
      { amenity: "cafe", name: "Balzac's" },
      { amenity: "pub", name: "The Rhino" },
      { tourism: "hotel", name: "Fairmont Royal York" },
      { shop: "department_store", name: "Hudson's Bay" },
      { shop: "variety_store", name: "Dollarama" },
      { shop: "doityourself", name: "Home Depot" },
      { shop: "hardware", name: "Home Hardware" },
      { shop: "furniture", name: "IKEA" },
      { shop: "electronics", name: "Best Buy" },
      { shop: "clothes", name: "Uniqlo" },
      { amenity: "cinema", name: "Scotiabank Theatre" },
      { railway: "station", name: "Union" },
    ];
    const payload = {
      elements: tagged.map((tags, i) => ({
        type: "node",
        id: i + 1,
        lat: 43.65 + i * 0.0005,
        lon: -79.38,
        tags,
      })),
    };

    const provider = createOverpassPlacesProvider({ fetchImpl: stubFetch(payload) });
    const places = await provider.findNearby({ latitude: 43.65, longitude: -79.38 });
    const byName = Object.fromEntries(
      places.map((p) => [p.name, [p.placeType, p.osmTag, p.mcc, p.category]]),
    );

    expect(byName).toEqual({
      "The Keg": ["restaurant", "amenity=restaurant", "5812", "dining"],
      "Tim Hortons": ["fast_food", "amenity=fast_food", "5814", "dining"],
      "Balzac's": ["cafe", "amenity=cafe", "5814", "dining"],
      "The Rhino": ["pub", "amenity=pub", "5813", "dining"],
      "Fairmont Royal York": ["hotel", "tourism=hotel", "7011", "travel"],
      "Hudson's Bay": ["department_store", "shop=department_store", "5311", "other"],
      Dollarama: ["variety_store", "shop=variety_store", "5331", "other"],
      "Home Depot": ["doityourself", "shop=doityourself", "5200", "other"],
      "Home Hardware": ["hardware", "shop=hardware", "5251", "other"],
      IKEA: ["furniture", "shop=furniture", "5712", "other"],
      "Best Buy": ["electronics", "shop=electronics", "5732", "other"],
      Uniqlo: ["clothes", "shop=clothes", "5651", "other"],
      "Scotiabank Theatre": ["cinema", "amenity=cinema", "7832", "entertainment"],
      Union: ["station", "railway=station", "4111", "transit"],
    });
  });

  it("keeps OSM names as-is and classifies by the first requested tag", async () => {
    const payload = {
      elements: [
        {
          type: "node",
          id: 1,
          lat: 43.65,
          lon: -79.38,
          tags: { amenity: "bank", shop: "supermarket", name: "  No Frills — Bloor " },
        },
      ],
    };
    const provider = createOverpassPlacesProvider({ fetchImpl: stubFetch(payload) });
    const [place] = await provider.findNearby({ latitude: 43.65, longitude: -79.38 });

    expect(place?.name).toBe("No Frills — Bloor");
    expect(place?.placeType).toBe("supermarket");
    expect(place?.osmTag).toBe("shop=supermarket");
    expect(place?.category).toBe("groceries");
  });

  it("sends one query covering every store type and caps the results", async () => {
    const payload = {
      elements: Array.from({ length: 30 }, (_, i) => ({
        type: "node",
        id: i + 1,
        lat: 43.65 + i * 0.001,
        lon: -79.38,
        tags: { amenity: "restaurant", name: `Restaurant ${i}` },
      })),
    };
    const fetchImpl = stubFetch(payload);
    const provider = createOverpassPlacesProvider({ fetchImpl });
    const places = await provider.findNearby(
      { latitude: 43.65, longitude: -79.38 },
      { limit: 10 },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(places.map((p) => p.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Restaurant ${i}`),
    );

    const query = sentQuery(fetchImpl);
    for (const fragment of [
      "fuel",
      "supermarket",
      "pharmacy",
      "restaurant",
      "fast_food",
      "cafe",
      "hotel",
      "department_store",
      "doityourself",
      "electronics",
      "cinema",
    ]) {
      expect(query).toContain(fragment);
    }
  });

  it("throws when Overpass responds with an error status", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 504,
      statusText: "Gateway Timeout",
    })) as unknown as typeof fetch;

    const provider = createOverpassPlacesProvider({ fetchImpl });
    await expect(
      provider.findNearby({ latitude: 0, longitude: 0 }),
    ).rejects.toThrow(/Overpass request failed/i);
  });
});

describe("buildOverpassQuery", () => {
  const query = buildOverpassQuery(43.65, -79.38, 750);

  it("returns priority store types in full and caps the rest", () => {
    const [priority, secondary] = query.split(")->.priority;");
    expect(priority).toMatch(/\["amenity"~"\^\((?=[^)]*fuel)(?=[^)]*pharmacy)[^)]*\)\$"\]/);
    expect(priority).toMatch(/\["shop"~"\^\((?=[^)]*supermarket)[^)]*\)\$"\]/);
    expect(priority).not.toContain("restaurant");
    expect(secondary).toContain("restaurant");
    expect(secondary).toContain('["tourism"~');
    expect(secondary).toContain('["railway"~"^(station)$"]');
    expect(query).toContain(".priority out center tags;");
    expect(query).toMatch(/\.secondary out center tags \d+;/);
  });

  it("uses one regex clause per OSM key in each set", () => {
    const clauses = query.split("\n").filter((line) => line.trim().startsWith("nwr("));
    expect(clauses.length).toBeGreaterThanOrEqual(5);
    for (const clause of clauses) {
      expect(clause).toMatch(/\["(amenity|shop|tourism|railway)"~/);
    }
  });
});
