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

  it("returns matched brand when a nearby place maps to MERCHANT_BRANDS", async () => {
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
    expect(result.status).toBe("matched");
    if (result.status !== "matched") return;
    expect(result.match.brand.id).toBe("shell");
    expect(result.match.place.name).toBe("Shell");
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

  it("falls back when no catalog brand matches nearby places", async () => {
    mockedLocation.mockResolvedValue({
      ok: true,
      point: { latitude: 43.65, longitude: -79.38 },
    });
    stubPlaces([
      {
        id: "node/9",
        name: "Blue Bottle Coffee",
        latitude: 43.65,
        longitude: -79.38,
        distanceMeters: 10,
        brandHints: ["Blue Bottle Coffee"],
        rawTags: {},
      },
    ]);

    const result = await checkNearbyMerchant();
    expect(result.status).toBe("fallback");
    if (result.status !== "fallback") return;
    expect(result.reason).toBe("no_brand_match");
  });
});
