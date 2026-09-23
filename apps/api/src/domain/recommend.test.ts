import { describe, expect, it } from "vitest";
import type { CreditCard } from "./schema";
import { bestCard, recommendCards } from "./recommend";
import { DEFAULT_POINT_VALUATIONS } from "./valuations";

const baseCard = {
  issuer: "TD" as const,
  pointCurrency: "cashback" as const,
  network: "Visa" as const,
  lastVerified: "2026-09-20",
};

describe("recommendCards", () => {
  it("ranks Amex Cobalt near the top for groceries with default MR valuation", () => {
    const owned = [
      "amex-cobalt",
      "td-aeroplan-vi",
      "rbc-avion-vi",
      "tangerine-moneyback",
      "neo-mastercard",
    ];

    const ranked = recommendCards({
      ownedCardIds: owned,
      category: "groceries",
    });

    expect(ranked.length).toBe(5);
    expect(ranked[0]?.card.id).toBe("amex-cobalt");
    // 5× Amex MR @ 2.4¢ = 12¢/$
    expect(ranked[0]?.centsPerDollar).toBeCloseTo(12, 5);
    expect(ranked[0]?.reason).toContain("Amex MR");
  });

  it("respects custom point valuations", () => {
    const ranked = recommendCards({
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
      category: "groceries",
      valuations: { "Amex MR": 0.1 }, // intentionally low
    });

    // Tangerine 2% cashback (2¢/$) beats Cobalt at 5 × 0.1 = 0.5¢/$
    expect(ranked[0]?.card.id).toBe("tangerine-moneyback");
    expect(ranked[0]?.centsPerDollar).toBe(2);
  });

  it("falls back to base rate when monthly cap is exhausted", () => {
    const ranked = recommendCards({
      ownedCardIds: ["amex-cobalt", "pc-financial-we", "tangerine-moneyback"],
      category: "groceries",
      spendToDate: { monthly: { groceries: 2500 } },
    });

    const cobalt = ranked.find((r) => r.card.id === "amex-cobalt");
    expect(cobalt?.capExhausted).toBe(true);
    // Falls back to "other" rate of 1 × 2.4 = 2.4¢/$
    expect(cobalt?.centsPerDollar).toBeCloseTo(2.4, 5);
    // PC Optimum 3× uncapped (3¢/$) beats Cobalt's fallback
    expect(ranked[0]?.card.id).toBe("pc-financial-we");
    expect(ranked[0]?.centsPerDollar).toBe(3);
  });

  it("returns empty array when no owned / saved cards", () => {
    expect(
      recommendCards({ ownedCardIds: [], category: "dining" }),
    ).toEqual([]);
    expect(
      recommendCards({ ownedCardIds: ["does-not-exist"], category: "dining" }),
    ).toEqual([]);
    expect(bestCard({ ownedCardIds: [], category: "dining" })).toBeNull();
  });

  it("falls back to other when category has no explicit reward row", () => {
    const cards: CreditCard[] = [
      {
        ...baseCard,
        id: "only-other",
        name: "Other Only",
        annualFee: 0,
        rewardCategories: [{ category: "other", earnRate: 1 }],
      },
    ];

    const ranked = recommendCards({
      ownedCardIds: ["only-other"],
      category: "dining",
      cards,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.earnRate).toBe(1);
    expect(ranked[0]?.centsPerDollar).toBe(1);
    // Reason keeps the requested category label; earn rate comes from `other`.
    expect(ranked[0]?.reason).toMatch(/1% cash back on dining/i);
  });

  it("breaks ties by lower annual fee, then name", () => {
    const cards: CreditCard[] = [
      {
        ...baseCard,
        id: "tie-expensive-z",
        name: "Zeta Cash",
        annualFee: 120,
        rewardCategories: [
          { category: "dining", earnRate: 2 },
          { category: "other", earnRate: 1 },
        ],
      },
      {
        ...baseCard,
        id: "tie-cheap-b",
        name: "Beta Cash",
        annualFee: 0,
        rewardCategories: [
          { category: "dining", earnRate: 2 },
          { category: "other", earnRate: 1 },
        ],
      },
      {
        ...baseCard,
        id: "tie-cheap-a",
        name: "Alpha Cash",
        annualFee: 0,
        rewardCategories: [
          { category: "dining", earnRate: 2 },
          { category: "other", earnRate: 1 },
        ],
      },
    ];

    const ranked = recommendCards({
      ownedCardIds: ["tie-expensive-z", "tie-cheap-b", "tie-cheap-a"],
      category: "dining",
      cards,
    });

    expect(ranked.map((r) => r.centsPerDollar)).toEqual([2, 2, 2]);
    expect(ranked.map((r) => r.card.id)).toEqual([
      "tie-cheap-a",
      "tie-cheap-b",
      "tie-expensive-z",
    ]);
  });

  it("bestCard returns the top recommendation", () => {
    const best = bestCard({
      ownedCardIds: ["scotia-gold-amex", "amex-cobalt", "rbc-cashback"],
      category: "groceries",
    });
    // Cobalt 12¢/$ vs Scotia Gold 5× Scene+ @ 1¢ = 5¢/$
    expect(best?.card.id).toBe("amex-cobalt");
  });

  it("uses cashback valuation of 1.0 correctly", () => {
    expect(DEFAULT_POINT_VALUATIONS.cashback).toBe(1);
    const ranked = recommendCards({
      ownedCardIds: ["simplii-cashback"],
      category: "groceries",
    });
    // 4% cashback = 4¢/$
    expect(ranked[0]?.centsPerDollar).toBe(4);
  });
});
