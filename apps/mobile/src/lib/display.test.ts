import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAmount } from "./amount";
import { resolveAssetUrl } from "./api-client";
import type { CreditCard, LoyaltyProgram, RecommendationItem } from "./api-types";
import { COMMON_CARD_IDS, pickCommonCards, searchCards } from "./common-cards";
import { initials, programForCard } from "./programs";
import {
  breakdownRows,
  earnSummary,
  estimateNote,
  formatAmountShort,
  formatCad,
  formatNumber,
  formatVerifiedDate,
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

describe("resolveAssetUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes absolute URLs through and resolves API paths", () => {
    vi.stubEnv("EXPO_PUBLIC_NORTHTAP_API_URL", "https://api.northtap.test/");
    expect(resolveAssetUrl("https://cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(resolveAssetUrl("//cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(resolveAssetUrl("/assets/cards/x.png")).toBe("https://api.northtap.test/assets/cards/x.png");
    expect(resolveAssetUrl("assets/cards/x.png")).toBe("https://api.northtap.test/assets/cards/x.png");
    expect(resolveAssetUrl("  ")).toBeNull();
    expect(resolveAssetUrl(null)).toBeNull();
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

  it("formats points with thousands separators and at most two decimals", () => {
    expect(formatNumber(400)).toBe("400");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(12345.678)).toBe("12,345.68");
  });
});

/** Shaped like the API's category-only answer for $100 of gas. */
const TRIANGLE_PROGRAM = {
  id: "triangle",
  name: "Triangle Rewards",
  pointCurrency: "Triangle",
  logoUrl: null,
} as unknown as LoyaltyProgram;

const triangle = {
  rank: 1,
  card: { ...card("triangle-we", "Canadian Tire", "Triangle World Elite Mastercard", "Triangle"), lastVerified: "2026-09-20" },
  earnRate: 4,
  pointValue: 1,
  centsPerDollar: 4,
  estimatedCentsBack: 400,
  estimatedRewardCad: 4,
  capExhausted: false,
  reason: "4× Triangle on gas",
  valueBreakdown: [
    {
      label: "4× Triangle on gas",
      kind: "card_earn",
      amountCad: 4,
      points: 400,
      pointCurrency: "Triangle",
      centsPerPoint: 1,
    },
  ],
} as RecommendationItem;

const costco = {
  ...triangle,
  card: card("cibc-costco-mc", "CIBC", "Costco Mastercard", "cashback"),
  earnRate: 3,
  estimatedRewardCad: 3,
  valueBreakdown: [{ label: "3% cash back on gas", kind: "card_earn", amountCad: 3 }],
} as RecommendationItem;

describe("category-earn breakdown", () => {
  const input = { category: "gas" as const, amountCad: 100, programs: [TRIANGLE_PROGRAM] };

  it("phone/tablet: earn rate, points earned and point value", () => {
    expect(breakdownRows(triangle, input)).toEqual([
      { label: "Earn rate on gas", value: "4 pts per $1" },
      { label: "Points earned", value: "400 Triangle Rewards" },
      { label: "Point value", value: "1¢ each" },
    ]);
  });

  it("desktop: adds the category and the total", () => {
    expect(breakdownRows(triangle, { ...input, detailed: true })).toEqual([
      { label: "Spending category", value: "Gas" },
      { label: "Earn rate on gas", value: "4 Triangle Rewards per $1" },
      { label: "Points earned on $100", value: "400" },
      { label: "Point value", value: "1¢ each" },
      { label: "Total back", value: "$4.00", total: true },
    ]);
  });

  it("cash back cards show the percentage only", () => {
    expect(breakdownRows(costco, input)).toEqual([{ label: "Cash back on gas", value: "3%" }]);
    expect(breakdownRows(costco, { ...input, detailed: true }).at(-1)).toEqual({
      label: "Total back",
      value: "$3.00",
      total: true,
    });
  });

  it("falls back to the item's rate and point value without a breakdown", () => {
    const old = { ...triangle, valueBreakdown: undefined, pointValue: 0.7 };
    expect(breakdownRows(old, input)).toEqual([
      { label: "Earn rate on gas", value: "4 pts per $1" },
      { label: "Points earned", value: "400 Triangle Rewards" },
      { label: "Point value", value: "0.7¢ each" },
    ]);
  });

  it("summarises each card's category earn for the compare rows", () => {
    expect(earnSummary(triangle, "gas", [TRIANGLE_PROGRAM])).toBe("4× Triangle Rewards on gas");
    expect(earnSummary(costco, "gas", [])).toBe("3% cash back on gas");
    expect(earnSummary({ ...triangle, capExhausted: true }, "groceries", [])).toBe(
      "4× Triangle on groceries (bonus cap reached)",
    );
  });

  it("notes the category rate and the verified date", () => {
    expect(estimateNote(triangle, "gas")).toBe(
      "Estimate from the card's gas category rate. Rates verified Sep 20, 2026.",
    );
    expect(estimateNote(triangle, "other")).toBe(
      "Estimate from the card's base earn rate. Rates verified Sep 20, 2026.",
    );
    expect(estimateNote(triangle, "gas", true)).toBe(
      "Based on each card's published rate for the purchase category. Rates verified Sep 20, 2026.",
    );
  });
});
