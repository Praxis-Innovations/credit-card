import { describe, expect, it } from "vitest";
import { parseAmount } from "./amount";
import type { CreditCard, LoyaltyProgram, RecommendationItem } from "./api-types";
import { COMMON_CARD_IDS, pickCommonCards, searchCards } from "./common-cards";
import { initials, programForCard } from "./programs";
import {
  assumptionsNote,
  formatAmountShort,
  formatCad,
  formatVerifiedDate,
  otherCardSubtitle,
} from "./result-copy";

const card = (id: string, issuer: string, name: string, pointCurrency: string): CreditCard =>
  ({
    id,
    issuer,
    name,
    pointCurrency,
    network: "Visa",
    annualFee: 0,
    lastVerified: "2026-09-20",
    rewardCategories: [],
  }) as unknown as CreditCard;

const SCENE: LoyaltyProgram = {
  id: "scene-plus",
  name: "Scene+",
  pointCurrency: "Scene+",
  logoUrl: "https://example.test/scene.png",
  logoAlt: null,
} as unknown as LoyaltyProgram;

describe("programs", () => {
  it("resolves the loyalty program by point currency, with its logo", () => {
    expect(programForCard({ pointCurrency: "scene+" }, [SCENE])).toEqual({
      name: "Scene+",
      logoUrl: "https://example.test/scene.png",
      logoAlt: "Scene+",
    });
  });

  it("labels cash back and falls back to the currency name", () => {
    expect(programForCard({ pointCurrency: "cashback" }, [SCENE]).name).toBe("Cash back");
    expect(programForCard({ pointCurrency: "Aeroplan" }, [SCENE])).toEqual({
      name: "Aeroplan",
      logoUrl: null,
      logoAlt: null,
    });
  });

  it("builds placeholder initials", () => {
    expect(initials("Scene+")).toBe("S+");
    expect(initials("Tim Hortons")).toBe("TH");
    expect(initials("Petro-Canada")).toBe("PC");
    expect(initials("Shell")).toBe("S");
    expect(initials("Cash back")).toBe("$");
    expect(initials("Loblaws (Queen St)")).toBe("L");
    expect(initials("")).toBe("?");
  });
});

describe("common cards", () => {
  const catalog = [
    card("amex-cobalt", "American Express", "Cobalt", "Amex MR"),
    card("scotia-gold-amex", "Scotiabank", "Gold American Express", "Scene+"),
    card("not-common", "Some Bank", "Plain Visa", "cashback"),
  ];

  it("keeps config order and skips ids missing from the API catalog", () => {
    expect(pickCommonCards(catalog).map((c) => c.id)).toEqual(["scotia-gold-amex", "amex-cobalt"]);
    expect(COMMON_CARD_IDS.length).toBeGreaterThan(0);
  });

  it("searches issuer, name and program with every term required", () => {
    const program = (c: CreditCard) => (c.pointCurrency === "Scene+" ? "Scene+" : c.pointCurrency);
    expect(searchCards(catalog, "scotia gold", program).map((c) => c.id)).toEqual([
      "scotia-gold-amex",
    ]);
    expect(searchCards(catalog, "scene", program).map((c) => c.id)).toEqual(["scotia-gold-amex"]);
    expect(searchCards(catalog, "scotia cobalt", program)).toEqual([]);
    expect(searchCards(catalog, "   ", program)).toEqual([]);
  });
});

describe("parseAmount", () => {
  it("accepts dollar-ish input and rejects the rest", () => {
    expect(parseAmount("100")).toBe(100);
    expect(parseAmount("$1,200.50")).toBe(1200.5);
    expect(parseAmount(".5")).toBe(0.5);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12a")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
  });
});

describe("result copy", () => {
  it("formats money and dates", () => {
    expect(formatCad(3.5)).toBe("$3.50");
    expect(formatAmountShort(100)).toBe("$100");
    expect(formatAmountShort(87.42)).toBe("$87.42");
    expect(formatVerifiedDate("2026-09-22")).toBe("Sep 22, 2026");
    expect(formatVerifiedDate("2026-01-05T10:00:00Z")).toBe("Jan 5, 2026");
    expect(formatVerifiedDate("unknown")).toBe("unknown");
  });

  it("describes fuel and point assumptions from the API", () => {
    expect(
      assumptionsNote({
        assumptions: { cadPerLitre: 1.5, litres: 66.67, pointValuations: { "Scene+": 1 } },
        category: "gas",
        fuelGrade: "regular",
      }),
    ).toBe(
      "Estimate for about 67 L at $1.50/L, with points valued at 1¢ each. Assumes regular fuel; premium-only bonuses aren't counted.",
    );
  });

  it("lists distinct point valuations and promo end dates", () => {
    expect(
      assumptionsNote({
        assumptions: {
          cadPerLitre: null,
          litres: null,
          pointValuations: { "Scene+": 1, Aeroplan: 1.5 },
        },
        breakdown: [
          { label: "Promo", kind: "card_earn", amountCad: 1, promotional: true, promotionalEnds: "2026-12-31" },
        ],
        category: "groceries",
      }),
    ).toBe(
      "Estimate for points valued at 1¢ (Scene+), 1.5¢ (Aeroplan). Includes a promotional rate ending Dec 31, 2026.",
    );
  });

  it("returns null when there's nothing to say", () => {
    expect(assumptionsNote({ category: "dining" })).toBeNull();
  });

  it("uses the card-earn label for other-card rows", () => {
    const rec = {
      reason: "fallback reason",
      valueBreakdown: [
        { label: "Instant 3¢/L", kind: "cents_per_litre_instant", amountCad: 2 },
        { label: "3% cash back on gas", kind: "card_earn", amountCad: 3 },
      ],
    } as unknown as RecommendationItem;
    expect(otherCardSubtitle(rec)).toBe("3% cash back on gas");
    expect(otherCardSubtitle({ reason: "only reason" } as RecommendationItem)).toBe("only reason");
  });
});
