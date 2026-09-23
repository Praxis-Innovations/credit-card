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

import {
  clearOnboardingComplete,
  loadOnboardingComplete,
  markOnboardingComplete,
  ONBOARDING_COMPLETE_KEY,
} from "./onboarding";
import {
  buildOnboardingDemoRecommendation,
  DEMO_PURCHASE,
  DEMO_WALLET_IDS,
  formatDemoEarnLabel,
} from "./onboarding-demo";

const API_KEY = "test-api-key-not-a-production-secret";

describe("onboarding storage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("defaults to incomplete", async () => {
    await expect(loadOnboardingComplete()).resolves.toBe(false);
  });

  it("persists completion flag", async () => {
    await markOnboardingComplete();
    expect(store.get(ONBOARDING_COMPLETE_KEY)).toBe("1");
    await expect(loadOnboardingComplete()).resolves.toBe(true);
  });

  it("clears completion flag", async () => {
    await markOnboardingComplete();
    await clearOnboardingComplete();
    await expect(loadOnboardingComplete()).resolves.toBe(false);
  });
});

describe("onboarding demo recommendation", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_NORTHTAP_API_URL = "http://api.test";
    process.env.EXPO_PUBLIC_NORTHTAP_API_KEY = API_KEY;
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          purchase: {
            amountCad: DEMO_PURCHASE.amountCad,
            category: DEMO_PURCHASE.category,
            merchant: DEMO_PURCHASE.merchant,
            merchantQuery: null,
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
              estimatedCentsBack: 540,
              estimatedRewardCad: 5.4,
              capExhausted: false,
              reason:
                "Cobalt gives 5× Amex MR on dining — best for this $45.00 purchase",
              usedPartnership: false,
            },
            {
              rank: 2,
              card: {
                id: "tangerine-moneyback",
                name: "Money-Back Mastercard",
                issuer: "Tangerine",
                annualFee: 0,
                pointCurrency: "cashback",
                rewardCategories: [],
                lastVerified: "2026-09-20",
              },
              earnRate: 2,
              pointValue: 1,
              centsPerDollar: 2,
              estimatedCentsBack: 90,
              estimatedRewardCad: 0.9,
              capExhausted: false,
              reason: "2% cash back — ~$0.90 back on this $45.00 purchase",
              usedPartnership: false,
            },
          ],
          bestCardId: "amex-cobalt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  it("ranks Cobalt first for the canned dining purchase", async () => {
    const result = await buildOnboardingDemoRecommendation();

    expect(result.purchase.amountCad).toBe(DEMO_PURCHASE.amountCad);
    expect(result.purchase.merchant).toBe(DEMO_PURCHASE.merchant);
    expect(result.bestCardId).toBe("amex-cobalt");
    expect(result.recommendations[0]?.card.name).toBe("Cobalt");
    expect(result.recommendations[0]?.reason).toMatch(/best for this/i);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_WALLET_IDS).toContain("amex-cobalt");
  });

  it("formats earn labels for cashback and points cards", async () => {
    const result = await buildOnboardingDemoRecommendation();
    const top = result.recommendations[0]!;
    expect(formatDemoEarnLabel(top)).toMatch(/Amex MR/);

    const cash = result.recommendations.find(
      (r) => r.card.pointCurrency === "cashback",
    );
    if (cash) {
      expect(formatDemoEarnLabel(cash)).toMatch(/% cash back/);
    }
  });
});
