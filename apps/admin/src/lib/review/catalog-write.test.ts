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

describe("buildCatalogWrite changed", () => {
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
        set: { welcome_offer: { summary: "50000 Scene+ points after spend", estimatedValueCad: 400 } },
      },
    });
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
