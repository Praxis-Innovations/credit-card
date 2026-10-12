import { describe, expect, it, vi } from "vitest";
import { findNearbyPlaces } from "./nearby";
import { setPlacesProvider, type NearbyPlace, type PlacesProvider } from "./places";

const POINT = { latitude: 43.65, longitude: -79.38 };

const SHELL: NearbyPlace = {
  id: "node/2",
  name: "Shell",
  latitude: 43.651,
  longitude: -79.381,
  distanceMeters: 120,
  placeType: "fuel",
  brandHints: ["Shell"],
  rawTags: { amenity: "fuel", brand: "Shell" },
};

function stubProvider(findNearby: PlacesProvider["findNearby"]) {
  const provider: PlacesProvider = { id: "test", findNearby: vi.fn(findNearby) };
  setPlacesProvider(provider);
  return provider;
}

describe("findNearbyPlaces", () => {
  it("returns what the places provider found, with the default radius", async () => {
    const provider = stubProvider(async () => [SHELL]);
    const result = await findNearbyPlaces(POINT);
    expect(result).toEqual({ status: "ok", places: [SHELL] });
    expect(provider.findNearby).toHaveBeenCalledWith(POINT, {
      radiusMeters: 750,
      signal: undefined,
    });
  });

  it("reports a failed lookup instead of throwing", async () => {
    stubProvider(async () => {
      throw new Error("Overpass timed out");
    });
    expect(await findNearbyPlaces(POINT)).toEqual({
      status: "lookup_failed",
      message: "Nearby places lookup failed.",
    });
  });
});
