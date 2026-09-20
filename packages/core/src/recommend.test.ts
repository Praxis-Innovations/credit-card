import { describe, expect, it } from "vitest";
import { CARDS, getCardById } from "./cards";
import { bestCard, recommendCards } from "./recommend";
import { DEFAULT_POINT_VALUATIONS } from "./valuations";

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

  it("returns empty array when no owned cards match", () => {
    expect(
      recommendCards({ ownedCardIds: [], category: "dining" }),
    ).toEqual([]);
    expect(
      recommendCards({ ownedCardIds: ["does-not-exist"], category: "dining" }),
    ).toEqual([]);
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

  it("dataset has ~40 cards with required fields", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(38);
    expect(CARDS.length).toBeLessThanOrEqual(45);
    for (const card of CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.issuer).toBeTruthy();
      expect(card.rewardCategories.length).toBeGreaterThan(0);
      expect(card.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getCardById(card.id)).toBe(card);
    }
  });
});
