import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestRecommendation } from "./recommend";

const API_KEY = "nt_live_northtap_expo_internal_v1_7f3a9c2e8b1d4f06";

beforeEach(() => {
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

  it("posts to the API and returns ranked recommendations", async () => {
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
              card: {
                id: "amex-cobalt",
                name: "Cobalt",
                issuer: "American Express",
                annualFee: 155.4,
                pointCurrency: "Amex MR",
                rewardCategories: [],
                lastVerified: "2026-09-20",
              },
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
                id: "scotia-scene-vi",
                name: "Scene+ Visa Infinite",
                issuer: "Scotiabank",
                annualFee: 120,
                pointCurrency: "Scene+",
                rewardCategories: [],
                lastVerified: "2026-09-20",
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
});
