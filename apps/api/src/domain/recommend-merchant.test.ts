import { describe, expect, it } from "vitest";
import {
  benefitToCentsPerDollar,
  recommendCardsForMerchant,
  summarizePartnershipBenefits,
} from "./recommend-merchant";
import type { PartnershipBenefit } from "./schema";

describe("benefitToCentsPerDollar", () => {
  it("converts ¢/L using the assumed pump price", () => {
    const benefit: PartnershipBenefit = {
      kind: "cents_per_litre_instant",
      amount: 3,
      summary: "3¢/L",
    };
    // 3¢/L ÷ $1.50/L = 2¢/$
    expect(benefitToCentsPerDollar(benefit, {}, 1.5)).toBeCloseTo(2, 5);
  });

  it("values points_per_dollar with valuations", () => {
    const benefit: PartnershipBenefit = {
      kind: "points_per_dollar",
      amount: 3,
      summary: "3 Scene+",
      pointCurrency: "Scene+",
    };
    expect(
      benefitToCentsPerDollar(benefit, { "Scene+": 1 }, 1.5),
    ).toBeCloseTo(3, 5);
  });
});

describe("summarizePartnershipBenefits", () => {
  it("collapses ¢/L tiers into a range", () => {
    const text = summarizePartnershipBenefits([
      {
        kind: "cents_per_litre_instant",
        amount: 3,
        summary: "3¢",
      },
      {
        kind: "cents_per_litre_instant",
        amount: 4,
        summary: "4¢ promo",
        promotional: true,
      },
    ]);
    expect(text).toBe("+3–4¢/L");
  });
});

describe("recommendCardsForMerchant", () => {
  it("ranks Shell Scene+ partnership ahead of generic gas earners", () => {
    const ranked = recommendCardsForMerchant({
      merchantBrandId: "shell",
      category: "gas",
      ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback", "amex-cobalt"],
    });

    const scene = ranked.find((r) => r.card.id === "scotia-scene-vi");
    expect(scene?.usedPartnership).toBe(true);
    expect(scene?.reason).toMatch(/Shell/i);
    expect(scene?.reason).toMatch(/Shell Go\+|Scene\+/i);
    expect(scene?.reason).toMatch(/\+3/);
    expect(scene?.partnershipCentsPerDollar).toBeGreaterThan(0);

    // Partnership stack (instant ¢/L + Scene+/L) should beat Cobalt's generic gas rate.
    expect(ranked[0]?.card.id).toBe("scotia-scene-vi");
    expect(ranked[0]?.centsPerDollar).toBeGreaterThan(
      ranked.find((r) => r.card.id === "amex-cobalt")?.centsPerDollar ?? 0,
    );
  });

  it("surfaces Loblaws PC Mastercard partnership reason", () => {
    const ranked = recommendCardsForMerchant({
      merchantBrandId: "loblaws",
      category: "groceries",
      ownedCardIds: ["pc-financial-we", "tangerine-moneyback"],
    });

    const pc = ranked.find((r) => r.card.id === "pc-financial-we");
    expect(pc?.usedPartnership).toBe(true);
    expect(pc?.reason).toMatch(/Loblaws/i);
    expect(pc?.reason).toMatch(/PC Optimum|%/i);
  });

  it("falls back to category ranking when brand id is unknown", () => {
    const ranked = recommendCardsForMerchant({
      merchantBrandId: "not-a-brand",
      category: "dining",
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });
    expect(ranked[0]?.card.id).toBe("amex-cobalt");
    expect(ranked[0]?.usedPartnership).toBe(false);
  });
});
