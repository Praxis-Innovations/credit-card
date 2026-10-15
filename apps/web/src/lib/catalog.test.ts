import { describe, expect, it } from "vitest";
import {
  CATALOG,
  cardDisplayName,
  dollarsBack,
  earnLabel,
  formatAnnualFee,
  formatIsoDate,
  oldestLastVerified,
  rankCatalogCards,
} from "./catalog";
import type { CategoryId, SnapshotCard } from "./catalog";

const CATEGORIES: CategoryId[] = ["gas", "groceries", "dining"];

function card(overrides: Partial<SnapshotCard>): SnapshotCard {
  return {
    id: "x",
    issuer: "TD",
    name: "X",
    annualFee: 0,
    pointCurrency: "cashback",
    lastVerified: "2026-09-20",
    rewardCategories: [],
    ...overrides,
  };
}

describe("rankCatalogCards", () => {
  it.each(CATEGORIES)("ranks every catalog card for %s, best first", (category) => {
    const ranked = rankCatalogCards(category);
    expect(ranked).toHaveLength(CATALOG.cards.length);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.centsPerDollar).toBeGreaterThanOrEqual(
        ranked[i]!.centsPerDollar,
      );
    }
  });

  it.each([
    // 2× Amex MR at 2.4¢; three cards tie, the lowest fee wins.
    ["gas", "amex-gold", 4.8, "$4.80"],
    // 5× Amex MR at 2.4¢.
    ["groceries", "amex-cobalt", 12, "$12.00"],
    ["dining", "amex-cobalt", 12, "$12.00"],
  ] as const)("%s: %s leads at %s¢/$ (%s on $100)", (category, id, cents, dollars) => {
    const [top] = rankCatalogCards(category);
    expect(top?.card.id).toBe(id);
    expect(top?.centsPerDollar).toBeCloseTo(cents, 10);
    expect(`$${dollarsBack(100, top!.centsPerDollar).toFixed(2)}`).toBe(dollars);
  });

  it("multiplies earn rate by point value and falls back to the 'other' rate", () => {
    const points = card({
      id: "points",
      pointCurrency: "Aeroplan",
      rewardCategories: [{ category: "other", earnRate: 1 }],
    });
    const [ranked] = rankCatalogCards("gas", [points], { Aeroplan: 2 });
    expect(ranked).toMatchObject({ earnRate: 1, pointValue: 2, centsPerDollar: 2 });
    expect(ranked?.reward).toBeUndefined();
  });

  it("breaks ties by lower annual fee, then name", () => {
    const rate = [{ category: "gas", earnRate: 2 }];
    const ranked = rankCatalogCards(
      "gas",
      [
        card({ id: "b", name: "B", annualFee: 120, rewardCategories: rate }),
        card({ id: "c", name: "C", annualFee: 0, rewardCategories: rate }),
        card({ id: "a", name: "A", annualFee: 120, rewardCategories: rate }),
      ],
      { cashback: 1 },
    );
    expect(ranked.map((r) => r.card.id)).toEqual(["c", "a", "b"]);
  });
});

describe("formatting", () => {
  it("rounds dollars back to the cent", () => {
    expect(dollarsBack(100, 2.55)).toBe(2.55);
    expect(dollarsBack(37.5, 3)).toBe(1.13);
  });

  it("labels earn rates, fees and names", () => {
    expect(earnLabel(card({ pointCurrency: "cashback" }), 4)).toBe("4% cash back");
    expect(earnLabel(card({ pointCurrency: "Amex MR" }), 5)).toBe("5× Amex MR");
    expect(formatAnnualFee(0)).toBe("$0");
    expect(formatAnnualFee(155.4)).toBe("$155.40");
    expect(formatAnnualFee(120)).toBe("$120");
    expect(cardDisplayName({ issuer: "American Express", name: "Cobalt" })).toBe(
      "American Express Cobalt",
    );
    expect(
      cardDisplayName({ issuer: "Scotiabank", name: "Scotiabank Gold American Express" }),
    ).toBe("Scotiabank Gold American Express");
  });

  it("reports the oldest lastVerified date in a stable format", () => {
    expect(
      oldestLastVerified([
        card({ lastVerified: "2026-09-22" }),
        card({ lastVerified: "2026-09-20" }),
      ]),
    ).toBe("2026-09-20");
    expect(formatIsoDate("2026-09-20")).toBe("September 20, 2026");
  });
});
