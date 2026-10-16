import { describe, expect, it } from "vitest";
import { buildCatalogWrite, cardIdFor, uniqueCardId } from "./catalog-write";

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

describe("cardIdFor", () => {
  it("builds a stable slug from issuer and name", () => {
    expect(cardIdFor("Scotiabank", "Gold American Express Card")).toBe("scotiabank-gold-amex-card");
    expect(cardIdFor("American Express", "Cobalt")).toBe("amex-cobalt");
  });
});

describe("uniqueCardId", () => {
  it("appends a suffix when the base id is taken", () => {
    expect(uniqueCardId("scotia-gold", new Set(["scotia-gold"]))).toBe("scotia-gold-2");
  });
});

describe("buildCatalogWrite skipped kinds", () => {
  it("does not touch the catalog for possibly discontinued findings", () => {
    expect(
      buildCatalogWrite({
        diffKind: "possibly_discontinued",
        linkedCardId: "scotia-gold-amex",
        cardName: "Gold",
        issuerName: "Scotiabank",
        fields: { fields: [] },
        existing,
        extractedPointCurrency: null,
        now: NOW,
      }),
    ).toEqual({ ok: true, write: null });
  });
});

describe("buildCatalogWrite changed merge", () => {
  it("updates only saved fields on a changed card, merging earn rates", () => {
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold American Express",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "annual_fee", save: true, page_value: "120", value: "599" },
          { key: "earn_rate.groceries", save: true, page_value: "5", value: "6" },
          { key: "name", save: false, page_value: "Gold", value: "Ignored" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      now: NOW,
    });
    expect(res).toEqual({
      ok: true,
      write: {
        op: "update",
        id: "scotia-gold-amex",
        set: {
          annual_fee: 599,
          reward_categories: [
            { category: "groceries", earnRate: 6, capMonthly: 2000 },
            { category: "other", earnRate: 1 },
          ],
          last_verified: NOW.date,
          verified_at: NOW.iso,
          status: "verified",
        },
      },
    });
  });
});

describe("buildCatalogWrite changed guards", () => {
  it("requires a linked catalog card for changed findings", () => {
    expect(
      buildCatalogWrite({
        diffKind: "changed",
        linkedCardId: null,
        cardName: "Gold",
        issuerName: "Scotiabank",
        fields: { fields: [{ key: "annual_fee", save: true, page_value: "120", value: "130" }] },
        existing: null,
        extractedPointCurrency: null,
        now: NOW,
      }),
    ).toMatchObject({ ok: false });
  });

  it("rewrites welcome-bonus points inside the existing summary", () => {
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [{ key: "welcome_bonus.points", save: true, page_value: "40000", value: "50000" }],
      },
      existing,
      extractedPointCurrency: null,
      now: NOW,
    });
    expect(res).toMatchObject({
      ok: true,
      write: {
        op: "update",
        set: {
          welcome_offer: {
            summary: "50000 Scene+ points after spend",
            estimatedValueCad: 400,
            points: 50000,
          },
        },
      },
    });
  });
});

describe("buildCatalogWrite indexed earn rates", () => {
  it("maps indexed earn-rate MCC/cap/date fields into reward_categories", () => {
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
        mccSource: "terms",
        capAnnual: 3000,
        capGroup: "5x-cap",
        rateAfterCap: 1,
        validFrom: "2026-01-01",
        validTo: "2027-06-30",
        quote: "5x at grocery stores MCC 5411",
        sourceUrl: "https://example.com/terms",
      },
      {
        category: "other",
        earnRate: 1,
        mccSource: "network_default",
        quote: "1x everywhere else",
      },
    ]);
  });
});

describe("buildCatalogWrite validation", () => {
  it("rejects invalid MCCs and non-ISO dates on approve", () => {
    const extracted = {
      earn_rates: [
        {
          category: "groceries",
          rate: 5,
          unit: "points_per_dollar",
          quote: "5x groceries",
          mccs: ["5411"],
        },
      ],
    };
    expect(
      buildCatalogWrite({
        diffKind: "changed",
        linkedCardId: "scotia-gold-amex",
        cardName: "Gold",
        issuerName: "Scotiabank",
        fields: {
          fields: [{ key: "earn_rates[0].mccs", save: true, page_value: "5411", value: "541" }],
        },
        existing,
        extractedPointCurrency: null,
        extracted,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("four digits") });

    expect(
      buildCatalogWrite({
        diffKind: "changed",
        linkedCardId: "scotia-gold-amex",
        cardName: "Gold",
        issuerName: "Scotiabank",
        fields: {
          fields: [
            { key: "welcome_bonus.valid_to", save: true, page_value: "2026-03-31", value: "03/31/2026" },
          ],
        },
        existing,
        extractedPointCurrency: null,
        now: NOW,
      }),
    ).toMatchObject({ ok: false, message: expect.stringContaining("YYYY-MM-DD") });
  });
});

describe("buildCatalogWrite welcome and promotions", () => {
  it("writes welcome bonus dates/rate and dated promotions into the catalog", () => {
    const extracted = {
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
    };
    const res = buildCatalogWrite({
      diffKind: "changed",
      linkedCardId: "scotia-gold-amex",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "welcome_bonus.rate", save: true, page_value: "", value: "1.5" },
          { key: "welcome_bonus.valid_from", save: true, page_value: "", value: "2026-01-01" },
          { key: "welcome_bonus.valid_to", save: true, page_value: "", value: "2026-06-30" },
          { key: "welcome_bonus.new_cardholders_only", save: true, page_value: "yes", value: "yes" },
          { key: "promotion.0.summary", save: true, page_value: "2x gas until March", value: "2x gas until March" },
          { key: "promotion.0.valid_to", save: true, page_value: "2026-03-31", value: "2026-04-30" },
        ],
      },
      existing,
      extractedPointCurrency: null,
      extracted,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "update") throw new Error("expected update");
    expect(res.write.set.welcome_offer).toEqual({
      summary: "40,000 Scene+ points after spend",
      estimatedValueCad: 400,
      rate: 1.5,
      validFrom: "2026-01-01",
      validTo: "2026-06-30",
      newCardholdersOnly: true,
    });
    expect(res.write.set.reward_categories).toEqual([
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

describe("buildCatalogWrite new", () => {
  it("inserts a new verified card from saved fields", () => {
    const res = buildCatalogWrite({
      diffKind: "new",
      linkedCardId: null,
      cardName: "E2E Approve Card",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "name", save: true, page_value: "E2E Approve Card", value: "E2E Approve Card" },
          { key: "annual_fee", save: true, page_value: "120", value: "120" },
          { key: "earn_rate.other", save: true, page_value: "1", value: "1" },
        ],
      },
      existing: null,
      extractedPointCurrency: "Scene+ points",
      now: NOW,
      takenIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "insert") throw new Error("expected insert");
    expect(res.write.row).toMatchObject({
      id: "scotiabank-e2e-approve-card",
      name: "E2E Approve Card",
      issuer: "Scotiabank",
      annual_fee: 120,
      point_currency: "Scene+",
      network: null,
      status: "verified",
      last_verified: NOW.date,
      reward_categories: [{ category: "other", earnRate: 1 }],
    });
  });

  it("defaults point currency and a base earn rate when the page omitted them", () => {
    const res = buildCatalogWrite({
      diffKind: "new",
      linkedCardId: null,
      cardName: "Mystery Card",
      issuerName: "Scotiabank",
      fields: {
        fields: [{ key: "name", save: true, page_value: "Mystery Card", value: "Mystery Card" }],
      },
      existing: null,
      extractedPointCurrency: null,
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok || !res.write || res.write.op !== "insert") throw new Error("expected insert");
    expect(res.write.row.point_currency).toBe("cashback");
    expect(res.write.row.reward_categories).toEqual([{ category: "other", earnRate: 1 }]);
    expect(res.write.row.annual_fee).toBe(0);
  });
});
