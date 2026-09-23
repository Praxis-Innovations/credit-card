import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { setPlacesProvider, type PlacesProvider } from "./places";
import { checkNearbyMerchant } from "./nearby";

vi.mock("./location", () => ({
  getForegroundPosition: vi.fn(),
}));

import { getForegroundPosition } from "./location";

const mockedLocation = vi.mocked(getForegroundPosition);

function stubPlaces(places: Awaited<ReturnType<PlacesProvider["findNearby"]>>) {
  const provider: PlacesProvider = {
    id: "test",
    findNearby: vi.fn(async () => places),
  };
  setPlacesProvider(provider);
  return provider;
}

describe("checkNearbyMerchant", () => {
  beforeEach(() => {
    mockedLocation.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the nearest named place as merchantQuery (no catalog match)", async () => {
    mockedLocation.mockResolvedValue({
      ok: true,
      point: { latitude: 43.65, longitude: -79.38 },
    });
    stubPlaces([
      {
        id: "node/1",
        name: "Independent Cafe",
        latitude: 43.65,
        longitude: -79.38,
        distanceMeters: 20,
        brandHints: ["Independent Cafe"],
        rawTags: {},
      },
      {
        id: "node/2",
        name: "Shell",
        latitude: 43.651,
        longitude: -79.381,
        distanceMeters: 120,
        placeType: "fuel",
        brandHints: ["Shell"],
        rawTags: { amenity: "fuel", brand: "Shell" },
      },
    ]);

    const result = await checkNearbyMerchant();
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    // Nearest first in provider order — Independent Cafe at 20m.
    expect(result.hit.merchantQuery).toBe("Independent Cafe");
    expect(result.hit.place.distanceMeters).toBe(20);
  });

  it("falls back when location permission is denied", async () => {
    mockedLocation.mockResolvedValue({
      ok: false,
      reason: "denied",
      message: "Location permission was not granted.",
    });

    const result = await checkNearbyMerchant();
    expect(result).toEqual({
      status: "fallback",
      reason: "denied",
      message: "Location permission was not granted.",
    });
  });

  it("falls back when no places are nearby", async () => {
    mockedLocation.mockResolvedValue({
      ok: true,
      point: { latitude: 43.65, longitude: -79.38 },
    });
    stubPlaces([]);

    const result = await checkNearbyMerchant();
    expect(result.status).toBe("fallback");
    if (result.status !== "fallback") return;
    expect(result.reason).toBe("no_places");
  });
});
