import { describe, expect, it } from "vitest";
import { buildCatalogWrite } from "./catalog-write";

const NOW = { date: "2026-10-16", iso: "2026-10-16T12:00:00.000Z" };

const existing = {
  id: "scotia-gold-amex",
  name: "Gold American Express",
  issuer: "Scotiabank",
  annual_fee: 120,
  point_currency: "Scene+",
  reward_categories: [
    { category: "groceries", earnRate: 5, capMonthly: 2000 },
    { category: "other", earnRate: 1 },
  ],
  welcome_offer: { summary: "40,000 Scene+ points after spend", estimatedValueCad: 400 },
  network: "Amex",
};

const groceriesExtracted = {
  earn_rates: [
    {
      category: "groceries",
      rate: 5,
      unit: "points_per_dollar",
      quote: "5x at grocery stores MCC 5411",
      mccs: ["5411"],
      mcc_source: "terms" as const,
      cap_amount: 2500,
      cap_period: "monthly",
      cap_group: "5x-cap",
      rate_after_cap: 1,
      valid_from: "2026-01-01",
      valid_to: "2026-12-31",
      source_url: "https://example.com/terms",
    },
    {
      category: "other",
      rate: 1,
      unit: "points_per_dollar",
      quote: "1x everywhere else",
    },
  ],
};

describe("indexed earn-rate field map", () => {
  it("maps saved indexed earn-rate fields onto matching catalog rows", () => {
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "earn_rates[0].mccs", save: true, page_value: "5411", value: "5411, 5412" },
          { key: "earn_rates[0].cap_amount", save: true, page_value: "2500", value: "3000" },
          { key: "earn_rates[0].cap_period", save: true, page_value: "monthly", value: "annual" },
          { key: "earn_rates[0].valid_to", save: true, page_value: "2026-12-31", value: "2027-06-30" },
          { key: "earn_rates[1].mcc_source", save: true, page_value: "", value: "network_default" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      extracted: groceriesExtracted,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    expect(res.write.set.reward_categories).toEqual([
      {
        category: "groceries",
        earnRate: 5,
        mccs: ["5411", "5412"],
        capAnnual: 3000,
        validTo: "2027-06-30",
      },
      { category: "other", earnRate: 1, mccSource: "network_default" },
    ]);
  });
});

describe("earn_rate category override with tiers", () => {
  it("applies earn_rate.<category> only to the max-rate tier, not lower same-category rows", () => {
    const momentum = {
      ...existing,
      reward_categories: [
        { category: "groceries", earnRate: 4, tierThreshold: 1000 },
        { category: "groceries", earnRate: 2 },
        { category: "other", earnRate: 1 },
      ],
    };
    const extracted = {
      earn_rates: [
        {
          category: "groceries",
          rate: 4,
          unit: "percent",
          quote: "4% groceries above $1,000",
          tier_threshold: 1000,
        },
        {
          category: "groceries",
          rate: 2,
          unit: "percent",
          quote: "2% groceries below threshold",
        },
        {
          category: "other",
          rate: 1,
          unit: "percent",
          quote: "1% other",
        },
      ],
    };
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Momentum",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "earn_rate.groceries", save: true, page_value: "4", value: "4" },
          { key: "earn_rates[0].tier_threshold", save: true, page_value: "1000", value: "1000" },
          { key: "earn_rates[1].mccs", save: true, page_value: "", value: "5411" },
        ],
      },
      existing: momentum,
      extractedPointCurrency: null,
      extracted,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    const groceries = (res.write.set.reward_categories ?? []).filter((r) => r.category === "groceries");
    expect(groceries).toEqual([
      { category: "groceries", earnRate: 4, tierThreshold: 1000 },
      { category: "groceries", earnRate: 2, mccs: ["5411"] },
    ]);
  });
});

describe("indexed earn-rate decline and preserve", () => {
  it("keeps the catalog rate when an earn_rate decision is declined beside a saved MCC", () => {
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "earn_rate.groceries", save: false, page_value: "5", value: "6" },
          { key: "earn_rates[0].mccs", save: true, page_value: "5411", value: "5411, 5412" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      extracted: groceriesExtracted,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    expect(res.write.set.reward_categories).toEqual([
      { category: "groceries", earnRate: 5, capMonthly: 2000, mccs: ["5411", "5412"] },
      { category: "other", earnRate: 1 },
    ]);
  });

  it("keeps an existing catalog category that is missing from the extraction", () => {
    const withTravel = {
      ...existing,
      reward_categories: [
        ...existing.reward_categories,
        { category: "travel", earnRate: 3, mccs: ["3000"] },
      ],
    };
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [{ key: "earn_rates[0].mccs", save: true, page_value: "5411", value: "5411" }],
      },
      existing: withTravel,
      extractedPointCurrency: null,
      extracted: groceriesExtracted,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    expect(res.write.set.reward_categories).toEqual([
      { category: "groceries", earnRate: 5, capMonthly: 2000, mccs: ["5411"] },
      { category: "other", earnRate: 1 },
      { category: "travel", earnRate: 3, mccs: ["3000"] },
    ]);
  });
});

describe("promotion rate rows", () => {
  it("writes dated rate promotions into reward_categories", () => {
    const dated = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "promotion.0.summary", save: true, page_value: "2x gas", value: "2x gas" },
          { key: "promotion.0.valid_to", save: true, page_value: "2026-03-31", value: "2026-04-30" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      extracted: {
        promotions: [
          {
            summary: "2x gas",
            rate: 2,
            points: null,
            categories: ["gas"],
            valid_from: "2026-01-01",
            valid_to: "2026-03-31",
            quote: "Earn 2x on gas",
            source_url: "https://example.com/promo",
          },
        ],
      },
      now: NOW,
    });
    expect(dated.ok).toBe(true);
    if (!dated.ok || !dated.write || dated.write.op !== "update") throw new Error("expected update");
    expect(dated.write.set.reward_categories).toEqual([
      ...existing.reward_categories,
      {
        category: "gas",
        earnRate: 2,
        quote: "Earn 2x on gas",
        validFrom: "2026-01-01",
        validTo: "2026-04-30",
        sourceUrl: "https://example.com/promo",
      },
    ]);
  });
});

describe("promotion points-only skip", () => {
  it("skips points-only promotions instead of writing a 0x earn-rate row", () => {
    const pointsOnly = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "promotion.0.summary", save: true, page_value: "5k grocery bonus", value: "5k grocery bonus" },
          { key: "promotion.0.points", save: true, page_value: "5000", value: "5000" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      extracted: {
        promotions: [
          {
            summary: "5k grocery bonus",
            rate: null,
            points: 5000,
            categories: ["groceries"],
            valid_from: "2026-01-01",
            valid_to: "2026-12-31",
            quote: "Earn 5,000 bonus points on groceries until Dec 31",
            source_url: null,
          },
        ],
      },
      now: NOW,
    });
    expect(pointsOnly.ok).toBe(true);
    if (!pointsOnly.ok || !pointsOnly.write || pointsOnly.write.op !== "update") {
      throw new Error("expected update");
    }
    expect(pointsOnly.write.set.reward_categories).toEqual(existing.reward_categories);
  });
});

describe("promotion re-approval dedupe", () => {
  it("replaces matching promotion rows on re-approval instead of duplicating them", () => {
    const withPromo = {
      ...existing,
      reward_categories: [
        ...existing.reward_categories,
        {
          category: "gas",
          earnRate: 2,
          quote: "Earn 2x on gas",
          validFrom: "2026-01-01",
          validTo: "2026-03-31",
          sourceUrl: "https://example.com/promo",
        },
      ],
    };
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "promotion.0.summary", save: true, page_value: "2x gas until March", value: "2x gas until March" },
          { key: "promotion.0.valid_to", save: true, page_value: "2026-03-31", value: "2026-03-31" },
        ],
      },
      existing: withPromo,
      extractedPointCurrency: null,
      extracted: {
        promotions: [
          {
            summary: "2x gas until March",
            rate: 2,
            points: null,
            categories: ["gas"],
            valid_from: "2026-01-01",
            valid_to: "2026-03-31",
            quote: "Earn 2x on gas",
            source_url: "https://example.com/promo",
          },
        ],
      },
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    const gas = (res.write.set.reward_categories ?? []).filter((r) => r.category === "gas");
    expect(gas).toHaveLength(1);
    expect(gas[0]).toMatchObject({
      earnRate: 2,
      quote: "Earn 2x on gas",
      validFrom: "2026-01-01",
      validTo: "2026-03-31",
    });
  });
});
