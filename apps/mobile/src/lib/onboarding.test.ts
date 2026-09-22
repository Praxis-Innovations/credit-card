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
  it("ranks Cobalt first for the canned dining purchase", () => {
    const result = buildOnboardingDemoRecommendation();

    expect(result.purchase.amountCad).toBe(DEMO_PURCHASE.amountCad);
    expect(result.purchase.merchant).toBe(DEMO_PURCHASE.merchant);
    expect(result.bestCardId).toBe("amex-cobalt");
    expect(result.recommendations[0]?.card.name).toBe("Cobalt");
    expect(result.recommendations[0]?.reason).toMatch(/best for this/i);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_WALLET_IDS).toContain("amex-cobalt");
  });

  it("formats earn labels for cashback and points cards", () => {
    const result = buildOnboardingDemoRecommendation();
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
