import { describe, expect, it, vi } from "vitest";
import { createOverpassPlacesProvider } from "./overpass";

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

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    })) as unknown as typeof fetch;

    const provider = createOverpassPlacesProvider({ fetchImpl });
    const places = await provider.findNearby(
      { latitude: 43.65, longitude: -79.38 },
      { radiusMeters: 500 },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(places[0]?.name).toBe("Shell");
    expect(places[0]?.placeType).toBe("fuel");
    expect(places[0]?.brandHints).toContain("Shell");
    expect(places.some((p) => p.name === "Loblaws")).toBe(true);
    expect(places.map((p) => p.distanceMeters)).toEqual(
      [...places.map((p) => p.distanceMeters)].sort((a, b) => a - b),
    );
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
