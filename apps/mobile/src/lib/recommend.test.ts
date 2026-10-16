import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("./ssr-safe-storage", () => ({
  ssrSafeStorage: {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
}));

import { recommendationRequestFor, requestRecommendation } from "./recommend";
import { loadLastRecommendation } from "./last-recommendation-cache";
import { choiceForCategory, choiceFromBrand, choiceFromNearby } from "./stores";

const API_KEY = "test-api-key-not-a-production-secret";

const cobaltCard = {
  id: "amex-cobalt",
  name: "Cobalt",
  issuer: "American Express",
  annualFee: 155.4,
  pointCurrency: "Amex MR",
  rewardCategories: [
    { category: "dining" as const, earnRate: 5, capMonthly: 2500 },
    { category: "other" as const, earnRate: 1 },
  ],
  lastVerified: "2026-09-20",
};

const onlineResponse = {
  purchase: {
    amountCad: 100,
    mcc: "5812",
    displayCategory: "dining" as const,
    merchant: "Joe's",
  },
  recommendations: [
    {
      rank: 1,
      card: cobaltCard,
      earnRate: 5,
      pointValue: 2.4,
      centsPerDollar: 12,
      estimatedCentsBack: 1200,
      estimatedRewardCad: 12,
      capExhausted: false,
      reason: "Cobalt gives 5× Amex MR on dining — best for this $100.00 purchase",
    },
  ],
  bestCardId: "amex-cobalt",
};

const STORE = {
  name: "Joe's",
  category: "dining" as const,
  logoUrl: null,
  logoAlt: null,
  source: "search" as const,
};

beforeEach(() => {
  store.clear();
  process.env.EXPO_PUBLIC_NORTHTAP_API_URL = "http://api.test";
  process.env.EXPO_PUBLIC_NORTHTAP_API_KEY = API_KEY;
  vi.restoreAllMocks();
});

describe("requestRecommendation", () => {
  it("rejects empty wallet without calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await requestRecommendation({
      amountCad: 50,
      merchantQuery: "Joe's",
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the API and caches the last successful response with its store", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(onlineResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const cactus = { ...STORE, name: "Cactus Club", category: "dining" as const };

    const result = await requestRecommendation(
      { amountCad: 100, merchantQuery: "Cactus Club", ownedCardIds: ["amex-cobalt"] },
      cactus,
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.response.bestCardId).toBe("amex-cobalt");
    expect(result.stale).toBe(false);

    const cached = await loadLastRecommendation();
    expect(cached?.response.bestCardId).toBe("amex-cobalt");
    expect(cached?.store?.name).toBe("Cactus Club");
  });

  it("sends store + amount only — no mcc, no legacy category", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(onlineResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const shell = choiceFromBrand({
      id: "shell",
      name: "Shell",
      category: "gas",
      operator: null,
      notes: null,
      sourceUrl: "https://example.test",
      lastVerified: "2026-09-22",
    });
    const request = recommendationRequestFor(shell, 60, ["triangle-we", "scotia-gold-amex"]);
    expect(request).toEqual({
      amountCad: 60,
      merchantQuery: "Shell",
      ownedCardIds: ["triangle-we", "scotia-gold-amex"],
      limit: 10,
    });

    await requestRecommendation(request, shell);
    const body = JSON.parse(String((fetchSpy.mock.calls[0]![1] as RequestInit).body));
    expect(body).toEqual({
      amountCad: 60,
      merchantQuery: "Shell",
      ownedCardIds: ["triangle-we", "scotia-gold-amex"],
      limit: 10,
    });
    expect(body).not.toHaveProperty("category");
    expect(body).not.toHaveProperty("mcc");
  });

  it("sends osmTag for nearby places and categoryFallback for bare categories", () => {
    const nearby = choiceFromNearby({
      id: "1",
      name: "Shell",
      category: "gas",
      osmTag: "amenity=fuel",
      distanceMeters: 80,
      brand: null,
    });
    expect(recommendationRequestFor(nearby, 40, ["amex-cobalt"])).toEqual({
      amountCad: 40,
      merchantQuery: "Shell",
      osmTag: "amenity=fuel",
      ownedCardIds: ["amex-cobalt"],
      limit: 10,
    });

    expect(recommendationRequestFor(choiceForCategory("groceries"), 100, ["amex-cobalt"])).toEqual({
      amountCad: 100,
      categoryFallback: "groceries",
      ownedCardIds: ["amex-cobalt"],
      limit: 10,
    });
  });

  it("shows last successful response (and its store) as stale when offline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(onlineResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await requestRecommendation(
      { amountCad: 100, merchantQuery: "Joe's", ownedCardIds: ["amex-cobalt"] },
      STORE,
    );

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await requestRecommendation(
      { amountCad: 40, merchantQuery: "Esso", ownedCardIds: ["amex-cobalt"] },
      { ...STORE, name: "Esso", category: "gas" },
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.stale).toBe(true);
    expect(result.response.bestCardId).toBe("amex-cobalt");
    // Stale payload is the previous success — not recomputed for the new query.
    expect(result.response.purchase.displayCategory).toBe("dining");
    expect(result.store?.name).toBe("Joe's");
  });

  it("errors when offline with no cached response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const result = await requestRecommendation({
      amountCad: 50,
      merchantQuery: "Joe's",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("offline_cache_miss");
  });

  it("does not fall back on HTTP auth errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "unauthorized", message: "Invalid API key" },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await requestRecommendation({
      amountCad: 50,
      merchantQuery: "Joe's",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(401);
  });
});
