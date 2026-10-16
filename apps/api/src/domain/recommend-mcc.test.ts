import { describe, expect, it } from "vitest";
import { recommendByMcc } from "./recommend-mcc";
import type { CreditCard, MerchantBrand } from "./schema";

const pointValuations = { "Amex MR": 2, cashback: 1, "Scene+": 1 } as const;

/** Cobalt-style shared $2500 monthly cap across 5× categories. */
const cobaltShared: CreditCard = {
  id: "fixture-cobalt",
  issuer: "American Express",
  name: "Cobalt",
  annualFee: 155.4,
  pointCurrency: "Amex MR",
  network: "Amex",
  lastVerified: "2026-10-01",
  welcomeOffer: { summary: "Up to 30,000 MR first year" },
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 5,
      capMonthly: 2500,
      capGroup: "cobalt-5x",
      rateAfterCap: 1,
      mccs: ["5411"],
      mccSource: "terms",
    },
    {
      category: "dining",
      earnRate: 5,
      capMonthly: 2500,
      capGroup: "cobalt-5x",
      rateAfterCap: 1,
      mccs: ["5812", "5814"],
      mccSource: "terms",
    },
    { category: "other", earnRate: 1 },
  ],
};

/** Gold Amex-style named merchants at Empire grocers. */
const goldNamed: CreditCard = {
  id: "fixture-gold-amex",
  issuer: "Scotiabank",
  name: "Gold American Express",
  annualFee: 120,
  pointCurrency: "Scene+",
  network: "Amex",
  lastVerified: "2026-10-01",
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 6,
      merchants: ["sobeys", "Sobeys"],
      mccSource: "terms",
      quote: "6 Scene+ at Sobeys",
    },
    { category: "groceries", earnRate: 1, mccs: ["5411"], mccSource: "network_default" },
    { category: "other", earnRate: 1 },
  ],
};

/** Tangerine-style user-chosen categories — warnings only. */
const tangerineChosen: CreditCard = {
  id: "fixture-tangerine",
  issuer: "Tangerine",
  name: "Money-Back Mastercard",
  annualFee: 0,
  pointCurrency: "cashback",
  network: "Mastercard",
  lastVerified: "2026-10-01",
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 2,
      userChosen: true,
    },
    { category: "other", earnRate: 0.5 },
  ],
};

/** Momentum-style spend tier. */
const momentumTier: CreditCard = {
  id: "fixture-momentum",
  issuer: "Scotiabank",
  name: "Momentum Visa Infinite",
  annualFee: 120,
  pointCurrency: "cashback",
  network: "Visa",
  lastVerified: "2026-10-01",
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 4,
      mccs: ["5411"],
      mccSource: "terms",
      tierThreshold: 25000,
      capMonthly: 500,
    },
    { category: "other", earnRate: 1 },
  ],
};

const sobeys: MerchantBrand = {
  id: "sobeys",
  name: "Sobeys",
  category: "groceries",
  sourceUrl: "https://example.com/sobeys",
  lastVerified: "2026-10-01",
  mcc: "5411",
  certainty: "confirmed",
  acceptedNetworks: ["visa", "mastercard", "amex"],
};

const costco: MerchantBrand = {
  id: "costco-ca",
  name: "Costco",
  category: "other",
  sourceUrl: "https://example.com/costco",
  lastVerified: "2026-10-01",
  mcc: "5300",
  certainty: "confirmed",
  acceptedNetworks: ["mastercard"],
};

const walmart: MerchantBrand = {
  id: "walmart",
  name: "Walmart",
  category: "groceries",
  sourceUrl: "https://example.com/walmart",
  lastVerified: "2026-10-01",
  mcc: "5310",
  certainty: "varies_by_store",
  acceptedNetworks: ["visa", "mastercard"],
};

const visaCash: CreditCard = {
  id: "fixture-visa",
  issuer: "TD",
  name: "TD Cash Back Visa",
  annualFee: 0,
  pointCurrency: "cashback",
  network: "Visa",
  lastVerified: "2026-10-01",
  rewardCategories: [
    { category: "other", earnRate: 1 },
    { category: "groceries", earnRate: 2, mccs: ["5411"], mccSource: "network_default" },
  ],
};

describe("recommendByMcc golden patterns", () => {
  it("Cobalt shared cap: groceries+dining share one pool", () => {
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

  it("Gold Amex named merchants at Sobeys beat generic grocery MCC", () => {
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

  it("Tangerine chosen category is a warning only (base rate used)", () => {
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

  it("Momentum spend tiers: below threshold uses base rate", () => {
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

  it("Walmart varies by store: lower code plus certainty warning", () => {
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
    // 5310 is not on the grocery MCC list for this Visa → base/other path.
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
