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
import { loadLastRecommendation } from "./last-recommendation-cache";

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
    category: "dining" as const,
    merchant: "Cactus Club",
    merchantQuery: null,
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
      reason: "Cobalt gives 5× Amex MR on dining — best for this $100.00 purchase",
      usedPartnership: false,
    },
  ],
  bestCardId: "amex-cobalt",
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
      category: "dining",
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the API and caches the last successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(onlineResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await requestRecommendation({
      amountCad: 100,
      category: "dining",
      merchant: "Cactus Club",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.bestCardId).toBe("amex-cobalt");

    const cached = await loadLastRecommendation();
    expect(cached?.bestCardId).toBe("amex-cobalt");
  });

  it("forwards merchantQuery for server-side brand resolution", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ...onlineResponse,
          purchase: {
            amountCad: 60,
            category: "gas",
            merchant: "Shell",
            merchantQuery: "Shell",
            merchantBrandId: "shell",
          },
          bestCardId: "scotia-scene-vi",
          recommendations: [
            {
              ...onlineResponse.recommendations[0],
              usedPartnership: true,
              reason: "Shell partnership",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await requestRecommendation({
      amountCad: 60,
      category: "gas",
      merchantQuery: "Shell",
      ownedCardIds: ["scotia-scene-vi"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.purchase.merchantQuery).toBe("Shell");
    const body = JSON.parse(
      String((fetchSpy.mock.calls[0]![1] as RequestInit).body),
    );
    expect(body.merchantQuery).toBe("Shell");
    expect(body.merchantBrandId).toBeUndefined();
  });

  it("shows last successful response as stale when offline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(onlineResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await requestRecommendation({
      amountCad: 100,
      category: "dining",
      ownedCardIds: ["amex-cobalt"],
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const result = await requestRecommendation({
      amountCad: 40,
      category: "gas",
      merchantQuery: "Shell",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.stale).toBe(true);
    expect(result.bestCardId).toBe("amex-cobalt");
    // Stale payload is the previous success — not recomputed for the new query.
    expect(result.purchase.category).toBe("dining");
  });

  it("errors when offline with no cached response", async () => {
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
      category: "dining",
      ownedCardIds: ["amex-cobalt"],
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(401);
  });
});
