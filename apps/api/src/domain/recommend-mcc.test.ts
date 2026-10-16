import { describe, expect, it } from "vitest";
import {
  cobaltShared,
  costco,
  goldNamed,
  momentumTier,
  pointValuations,
  sobeys,
  tangerineChosen,
  visaCash,
  walmart,
} from "./recommend-mcc.fixtures";
import { recommendByMcc } from "./recommend-mcc";
import type { MerchantBrand } from "./schema";

describe("recommendByMcc cobalt shared cap", () => {
  it("groceries and dining share one pool", () => {
    const before = recommendByMcc({
      amountCad: 100,
      ownedCardIds: ["fixture-cobalt"],
      mcc: "5411",
      cards: [cobaltShared],
      brands: [sobeys],
      store: { brandId: "sobeys" },
      valuations: pointValuations,
      mccCatalog: { categoryMccs: [{ category: "groceries", mcc: "5411" }] },
    });
    expect(before.recommendations[0]!.earnRate).toBe(5);
    expect(before.recommendations[0]!.warnings.some((w) => w.kind === "welcome_bonus")).toBe(
      true,
    );

    const after = recommendByMcc({
      amountCad: 100,
      ownedCardIds: ["fixture-cobalt"],
      mcc: "5812",
      cards: [cobaltShared],
      brands: [],
      valuations: pointValuations,
      capGroupSpendToDate: { "cobalt-5x": 2500 },
      mccCatalog: { categoryMccs: [{ category: "dining", mcc: "5812" }] },
    });
    expect(after.recommendations[0]!.earnRate).toBe(1);
    expect(after.recommendations[0]!.capExhausted).toBe(true);
  });
});

describe("recommendByMcc Gold Amex named merchants", () => {
  it("Sobeys beats generic grocery MCC", () => {
    const atSobeys = recommendByMcc({
      amountCad: 50,
      ownedCardIds: ["fixture-gold-amex"],
      cards: [goldNamed],
      brands: [sobeys],
      store: { brandId: "sobeys" },
      valuations: pointValuations,
    });
    expect(atSobeys.recommendations[0]!.matchKind).toBe("named_merchant");
    expect(atSobeys.recommendations[0]!.earnRate).toBe(6);
  });

  it("other grocers fall back to MCC list rate", () => {
    const otherGrocery: MerchantBrand = {
      ...sobeys,
      id: "independent-grocers",
      name: "Independent",
    };
    const elsewhere = recommendByMcc({
      amountCad: 50,
      ownedCardIds: ["fixture-gold-amex"],
      cards: [goldNamed],
      brands: [otherGrocery],
      store: { brandId: "independent-grocers", mcc: "5411" },
      valuations: pointValuations,
    });
    expect(elsewhere.recommendations[0]!.earnRate).toBe(1);
    expect(elsewhere.recommendations[0]!.matchKind).toBe("mcc_list");
  });
});

describe("recommendByMcc Tangerine chosen category", () => {
  it("is a warning only (base rate used)", () => {
    const result = recommendByMcc({
      amountCad: 80,
      ownedCardIds: ["fixture-tangerine"],
      mcc: "5411",
      cards: [tangerineChosen],
      brands: [sobeys],
      store: { brandId: "sobeys" },
      valuations: pointValuations,
    });
    const rec = result.recommendations[0]!;
    expect(rec.earnRate).toBe(0.5);
    expect(rec.warnings.some((w) => w.kind === "user_chosen_category")).toBe(true);
    expect(rec.matchKind).toBe("base_rate");
  });
});

describe("recommendByMcc Momentum spend tiers", () => {
  it("below threshold uses base rate", () => {
    const below = recommendByMcc({
      amountCad: 40,
      ownedCardIds: ["fixture-momentum"],
      mcc: "5411",
      cards: [momentumTier],
      brands: [sobeys],
      store: { brandId: "sobeys" },
      valuations: pointValuations,
      annualSpendByCard: { "fixture-momentum": 1000 },
    });
    expect(below.recommendations[0]!.earnRate).toBe(1);
    expect(
      below.recommendations[0]!.warnings.some((w) => w.kind === "tier_assumed_not_reached"),
    ).toBe(true);
  });

  it("above threshold uses tier rate", () => {
    const above = recommendByMcc({
      amountCad: 40,
      ownedCardIds: ["fixture-momentum"],
      mcc: "5411",
      cards: [momentumTier],
      brands: [sobeys],
      store: { brandId: "sobeys" },
      valuations: pointValuations,
      annualSpendByCard: { "fixture-momentum": 30000 },
    });
    expect(above.recommendations[0]!.earnRate).toBe(4);
  });
});

describe("recommendByMcc network acceptance", () => {
  it("Costco on Visa is not accepted", () => {
    const result = recommendByMcc({
      amountCad: 100,
      ownedCardIds: ["fixture-visa"],
      cards: [visaCash],
      brands: [costco],
      store: { brandId: "costco-ca" },
      valuations: pointValuations,
    });
    const rec = result.recommendations[0]!;
    expect(rec.matchKind).toBe("network_not_accepted");
    expect(rec.centsPerDollar).toBe(0);
    expect(rec.warnings.some((w) => w.kind === "network_not_accepted")).toBe(true);
  });
});

describe("recommendByMcc store certainty", () => {
  it("Walmart varies by store with certainty warning", () => {
    const result = recommendByMcc({
      amountCad: 60,
      ownedCardIds: ["fixture-visa"],
      cards: [visaCash],
      brands: [walmart],
      store: { brandId: "walmart" },
      valuations: pointValuations,
      mccCatalog: {
        categoryMccs: [
          { category: "groceries", mcc: "5411" },
          { category: "other", mcc: "5310" },
        ],
      },
    });
    const rec = result.recommendations[0]!;
    expect(rec.effectiveMcc).toBe("5310");
    expect(rec.confidence).toBe("varies_by_store");
    expect(result.warnings.some((w) => w.kind === "certainty")).toBe(true);
    expect(rec.earnRate).toBe(1);
  });

  it("unknown store uses base rate", () => {
    const result = recommendByMcc({
      amountCad: 25,
      ownedCardIds: ["fixture-visa"],
      cards: [visaCash],
      brands: [],
      store: { name: "Some Independent Shop" },
      valuations: pointValuations,
    });
    expect(result.purchase.matchKind).toBe("base_rate");
    expect(result.recommendations[0]!.earnRate).toBe(1);
    expect(result.recommendations[0]!.matchKind).toBe("base_rate");
  });
});
