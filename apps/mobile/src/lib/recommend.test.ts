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

import { requestRecommendation } from "./recommend";
import { loadWalletCardCache } from "./wallet-card-cache";

const API_KEY = "test-api-key-not-a-production-secret";

const cobaltCard = {
  id: "amex-cobalt",
  name: "Cobalt",
  issuer: "American Express",
  annualFee: 155.4,
  pointCurrency: "Amex MR",
  rewardCategories: [
    { category: "dining", earnRate: 5, capMonthly: 2500 },
    { category: "other", earnRate: 1 },
  ],
  lastVerified: "2026-09-20",
};

const tangerineCard = {
  id: "tangerine-moneyback",
  name: "Money-Back Mastercard",
  issuer: "Tangerine",
  annualFee: 0,
  pointCurrency: "cashback",
  rewardCategories: [
    { category: "dining", earnRate: 2 },
    { category: "other", earnRate: 0.5 },
  ],
  lastVerified: "2026-09-20",
};

beforeEach(() => {
  store.clear();
  process.env.EXPO_PUBLIC_NORTHTAP_API_URL = "http://api.test";
  process.env.EXPO_PUBLIC_NORTHTAP_API_KEY = API_KEY;
  vi.restoreAllMocks();
});

describe("requestRecommendation", () => {
  it("rejects empty wallet (no saved cards) without calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await requestRecommendation({
      amountCad: 50,
      category: "dining",
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(422);
    expect(result.error.code).toBe("empty_wallet");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns empty recommendations for unknown card ids (API response)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase: {
            amountCad: 50,
            category: "dining",
            merchant: null,
            merchantBrandId: null,
          },
          recommendations: [],
          bestCardId: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestRecommendation({
      amountCad: 50,
      category: "dining",
      ownedCardIds: ["not-a-real-card"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.recommendations).toEqual([]);
    expect(result.bestCardId).toBeNull();
  });

  it("posts to the API and caches wallet cards from the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase: {
            amountCad: 100,
            category: "dining",
            merchant: "Cactus Club",
            merchantBrandId: null,
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
              reason:
                "Cobalt gives 5× Amex MR on dining — best for this $100.00 purchase",
              usedPartnership: false,
            },
            {
              rank: 2,
              card: tangerineCard,
              earnRate: 2,
              pointValue: 1,
              centsPerDollar: 2,
              estimatedCentsBack: 200,
              estimatedRewardCad: 2,
              capExhausted: false,
              reason: "2% cash back",
              usedPartnership: false,
            },
          ],
          bestCardId: "amex-cobalt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestRecommendation({
      amountCad: 100,
      category: "dining",
      merchant: "Cactus Club",
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.bestCardId).toBe("amex-cobalt");
    expect(result.recommendations[0]?.reason).toMatch(/best for this/i);
    expect(result.recommendations[0]?.estimatedRewardCad).toBeCloseTo(12, 5);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/v1/recommendations");
    expect((init as RequestInit).method).toBe("POST");
    expect(
      ((init as RequestInit).headers as Headers).get("X-Api-Key"),
    ).toBe(API_KEY);

    const cached = await loadWalletCardCache();
    expect(cached.map((c) => c.id).sort()).toEqual([
      "amex-cobalt",
      "tangerine-moneyback",
    ]);
  });

  it("rejects non-positive amounts without calling the API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await requestRecommendation({
      amountCad: 0,
      category: "groceries",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards merchantBrandId for partnership-aware ranking", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase: {
            amountCad: 60,
            category: "gas",
            merchant: "Shell",
            merchantBrandId: "shell",
          },
          recommendations: [
            {
              rank: 1,
              card: {
                ...cobaltCard,
                id: "scotia-scene-vi",
                name: "Scene+ Visa Infinite",
                issuer: "Scotiabank",
                pointCurrency: "Scene+",
                annualFee: 120,
                rewardCategories: [
                  { category: "gas", earnRate: 1 },
                  { category: "other", earnRate: 1 },
                ],
              },
              earnRate: 1,
              pointValue: 1,
              centsPerDollar: 5,
              estimatedCentsBack: 300,
              estimatedRewardCad: 3,
              capExhausted: false,
              reason: "Shell — Scene+ Visa Infinite with Scene+ gets +3¢/L",
              usedPartnership: true,
              partnershipId: "shell-scene-scotia-scene-cards",
            },
          ],
          bestCardId: "scotia-scene-vi",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestRecommendation({
      amountCad: 60,
      category: "gas",
      merchantBrandId: "shell",
      ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.purchase.merchantBrandId).toBe("shell");
    expect(result.purchase.category).toBe("gas");
    expect(result.bestCardId).toBe("scotia-scene-vi");
    expect(result.recommendations[0]?.usedPartnership).toBe(true);
    expect(result.recommendations[0]?.reason).toMatch(/Shell/i);
    expect(result.recommendations[0]?.reason).toMatch(/\+3/);
  });

  it("falls back to cached category ranking when the network is down", async () => {
    // Warm cache via a successful call first.
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          purchase: {
            amountCad: 100,
            category: "dining",
            merchant: null,
            merchantBrandId: null,
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
              reason: "online",
              usedPartnership: false,
            },
            {
              rank: 2,
              card: tangerineCard,
              earnRate: 2,
              pointValue: 1,
              centsPerDollar: 2,
              estimatedCentsBack: 200,
              estimatedRewardCad: 2,
              capExhausted: false,
              reason: "online",
              usedPartnership: false,
            },
          ],
          bestCardId: "amex-cobalt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await requestRecommendation({
      amountCad: 100,
      category: "dining",
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const result = await requestRecommendation({
      amountCad: 100,
      category: "dining",
      merchant: "Cactus Club",
      merchantBrandId: "shell", // ignored offline — category-only
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.offline).toBe(true);
    expect(result.bestCardId).toBe("amex-cobalt");
    expect(result.purchase.merchantBrandId).toBeNull();
    expect(result.recommendations[0]?.usedPartnership).toBe(false);
    expect(result.recommendations[0]?.reason).toMatch(/\[offline\]/);
    expect(result.recommendations[0]?.estimatedRewardCad).toBeCloseTo(12, 5);
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
      category: "dining",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("unauthorized");
  });

  it("errors when offline with an empty cache", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const result = await requestRecommendation({
      amountCad: 50,
      category: "dining",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(503);
    expect(result.error.code).toBe("offline_cache_miss");
  });
});
