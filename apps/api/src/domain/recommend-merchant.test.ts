import { describe, expect, it } from "vitest";
import { MERCHANT_PARTNERSHIPS } from "./partnerships";
import {
  benefitToCentsPerDollar,
  FUEL_GRADE_SCOPES,
  isBenefitApplicable,
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

describe("isBenefitApplicable", () => {
  const cardIds = ["card-a", "card-b"];
  const benefit = (appliesTo?: string): PartnershipBenefit => ({
    kind: "cents_per_litre_instant",
    amount: 1,
    summary: "test",
    appliesTo,
  });

  it("applies unscoped and all-grade benefits to every grade", () => {
    for (const grade of ["regular", "premium"] as const) {
      expect(isBenefitApplicable(benefit(), "card-a", cardIds, grade)).toBe(true);
      expect(
        isBenefitApplicable(benefit("all_fuel"), "card-a", cardIds, grade),
      ).toBe(true);
    }
  });

  it("gates grade scopes on the requested grade, defaulting to regular", () => {
    expect(isBenefitApplicable(benefit("shell_vpower"), "card-a", cardIds)).toBe(
      false,
    );
    expect(
      isBenefitApplicable(benefit("shell_vpower"), "card-a", cardIds, "premium"),
    ).toBe(true);
    expect(isBenefitApplicable(benefit("regular_fuel"), "card-a", cardIds)).toBe(
      true,
    );
    expect(
      isBenefitApplicable(benefit("regular_fuel"), "card-a", cardIds, "premium"),
    ).toBe(false);
  });

  it("still restricts card-scoped benefits to the named cards", () => {
    expect(isBenefitApplicable(benefit("card-a"), "card-a", cardIds)).toBe(true);
    expect(isBenefitApplicable(benefit("card-a"), "card-b", cardIds)).toBe(false);
  });

  it("classifies every grade-specific scope in the partnership catalog", () => {
    const scopes = new Set(
      MERCHANT_PARTNERSHIPS.flatMap((p) =>
        p.benefits.flatMap((b) => (b.appliesTo ?? "").split("|")),
      ),
    );
    const gradeLike = [...scopes].filter((s) =>
      /premium|regular|vpower|v_power|octane|grade/i.test(s),
    );
    expect(gradeLike.sort()).toEqual(Object.keys(FUEL_GRADE_SCOPES).sort());
  });
});

describe("recommendCardsForMerchant", () => {
  it("ranks Shell Scene+ partnership ahead of generic gas earners on premium", () => {
    const ranked = recommendCardsForMerchant({
      merchantBrandId: "shell",
      category: "gas",
      fuelGrade: "premium",
      ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback", "amex-cobalt"],
    });

    const scene = ranked.find((r) => r.card.id === "scotia-scene-vi");
    expect(scene?.usedPartnership).toBe(true);
    expect(scene?.reason).toMatch(/Shell/i);
    expect(scene?.reason).toMatch(/Shell Go\+|Scene\+/i);
    expect(scene?.reason).toMatch(/\+3–4¢\/L/);
    expect(scene?.partnershipCentsPerDollar).toBeGreaterThan(0);

    // V-Power stack (7¢/L + 2 Scene+/L) beats Cobalt's generic gas rate.
    expect(ranked[0]?.card.id).toBe("scotia-scene-vi");
    expect(ranked[0]?.centsPerDollar).toBeGreaterThan(
      ranked.find((r) => r.card.id === "amex-cobalt")?.centsPerDollar ?? 0,
    );
  });

  it("excludes V-Power-only Shell benefits on regular fuel", () => {
    const ranked = recommendCardsForMerchant({
      merchantBrandId: "shell",
      category: "gas",
      ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback", "amex-cobalt"],
    });

    const scene = ranked.find((r) => r.card.id === "scotia-scene-vi");
    expect(scene?.reason).toMatch(/\+3¢\/L/);
    expect(scene?.reason).not.toMatch(/4¢/);
    expect(
      scene?.valueComponents.some((c) => c.benefit?.appliesTo === "shell_vpower"),
    ).toBe(false);
    // 1× gas (1¢) + 3¢/L (2¢) + 1 Scene+/L (0.67¢) no longer beats Cobalt (4.8¢).
    expect(scene?.centsPerDollar).toBeCloseTo(1 + 2 + 2 / 3, 10);
    expect(ranked[0]?.card.id).toBe("amex-cobalt");
  });

  it("flips Gold Amex vs Triangle World Elite at Shell between regular and premium", () => {
    const base = {
      merchantBrandId: "shell",
      category: "gas" as const,
      ownedCardIds: ["scotia-gold-amex", "triangle-we"],
    };

    const regular = recommendCardsForMerchant(base);
    expect(regular.map((r) => r.card.id)).toEqual([
      "triangle-we",
      "scotia-gold-amex",
    ]);
    expect(regular[0]?.centsPerDollar).toBeCloseTo(4, 10);
    expect(regular[1]?.centsPerDollar).toBeCloseTo(1 + 2 + 2 / 3, 10);

    const premium = recommendCardsForMerchant({ ...base, fuelGrade: "premium" });
    expect(premium.map((r) => r.card.id)).toEqual([
      "scotia-gold-amex",
      "triangle-we",
    ]);
    // 1× gas + (3+4)¢/L + (1+1) Scene+/L at $1.50/L
    expect(premium[0]?.centsPerDollar).toBeCloseTo(1 + 14 / 3 + 4 / 3, 10);
  });

  it("uses only the matching grade tier at Gas+ for Triangle cards", () => {
    const tiers = (fuelGrade: "regular" | "premium") =>
      recommendCardsForMerchant({
        merchantBrandId: "canadian-tire-gas-plus",
        category: "gas",
        ownedCardIds: ["triangle-we"],
        fuelGrade,
      })[0]!.valueComponents.map((c) => c.benefit?.appliesTo);

    expect(tiers("regular")).toContain("regular_fuel");
    expect(tiers("regular")).not.toContain("premium_fuel");
    expect(tiers("premium")).toContain("premium_fuel");
    expect(tiers("premium")).not.toContain("regular_fuel");
  });

  it("leaves non-fuel merchants unaffected by fuelGrade", () => {
    for (const merchantBrandId of ["loblaws", "sobeys", "shoppers-drug-mart"]) {
      const brandCategory =
        merchantBrandId === "shoppers-drug-mart" ? "drugstore" : "groceries";
      const input = {
        merchantBrandId,
        category: brandCategory as "groceries" | "drugstore",
        ownedCardIds: ["pc-financial-we", "scotia-gold-amex", "amex-cobalt"],
      };
      const regular = recommendCardsForMerchant({ ...input, fuelGrade: "regular" });
      const premium = recommendCardsForMerchant({ ...input, fuelGrade: "premium" });
      const omitted = recommendCardsForMerchant(input);
      expect(premium).toEqual(regular);
      expect(omitted).toEqual(regular);
    }
  });

  it("value components sum to centsPerDollar", () => {
    for (const fuelGrade of ["regular", "premium"] as const) {
      const ranked = recommendCardsForMerchant({
        merchantBrandId: "shell",
        category: "gas",
        fuelGrade,
        ownedCardIds: ["scotia-gold-amex", "triangle-we", "tangerine-moneyback"],
      });
      for (const rec of ranked) {
        const sum = rec.valueComponents.reduce((s, c) => s + c.centsPerDollar, 0);
        expect(sum).toBeCloseTo(rec.centsPerDollar, 10);
      }
    }
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
