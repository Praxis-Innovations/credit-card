import { describe, expect, it } from "vitest";
import { recommendCardsForMerchant } from "./recommend-merchant";
import { allocateCents, buildValueBreakdown } from "./value-breakdown";

const toCents = (cad: number) => Math.round(cad * 100);

describe("allocateCents", () => {
  it("rounds parts so they sum to the rounded total", () => {
    const exact = [200, 200 / 3, 100, 33.3333, 0.4999];
    const cents = allocateCents(exact);
    expect(cents.every(Number.isInteger)).toBe(true);
    expect(cents.reduce((s, c) => s + c, 0)).toBe(
      Math.round(exact.reduce((s, c) => s + c, 0)),
    );
  });

  it("absorbs float noise just below a whole cent", () => {
    expect(allocateCents([199.99999999997, 66.6666666667])).toEqual([200, 67]);
  });
});

describe("buildValueBreakdown", () => {
  const shellGoldAmex = (fuelGrade: "regular" | "premium") =>
    recommendCardsForMerchant({
      merchantBrandId: "shell",
      category: "gas",
      ownedCardIds: ["scotia-gold-amex"],
      fuelGrade,
    })[0]!;

  it("itemises Gold Amex at Shell on regular fuel", () => {
    const { items, totalCad, assumptions } = buildValueBreakdown(
      shellGoldAmex("regular").valueComponents,
      100,
      1.5,
    );
    expect(items.map((i) => [i.kind, i.amountCad])).toEqual([
      ["card_earn", 1],
      ["cents_per_litre_instant", 2],
      ["points_per_litre", 0.67],
    ]);
    expect(totalCad).toBe(3.67);
    expect(items.find((i) => i.kind === "points_per_litre")).toMatchObject({
      points: 66.67,
      pointCurrency: "Scene+",
      centsPerPoint: 1,
    });
    expect(items.some((i) => i.promotional)).toBe(false);
    expect(assumptions).toEqual({
      cadPerLitre: 1.5,
      litres: 66.67,
      pointValuations: { "Scene+": 1 },
    });
  });

  it("carries the end date on promotional benefits", () => {
    const { items } = buildValueBreakdown(
      shellGoldAmex("premium").valueComponents,
      100,
      1.5,
    );
    const promo = items.filter((i) => i.promotional);
    expect(promo).toHaveLength(1);
    expect(promo[0]).toMatchObject({
      kind: "cents_per_litre_instant",
      promotionalEnds: "2027-06-01",
    });
  });

  it("sums exactly to the total for awkward amounts", () => {
    const rec = shellGoldAmex("premium");
    for (const amountCad of [0.01, 1, 13.37, 47.29, 99.99, 100, 333.33]) {
      const { items, totalCad } = buildValueBreakdown(
        rec.valueComponents,
        amountCad,
        1.5,
      );
      expect(items.reduce((s, i) => s + toCents(i.amountCad), 0)).toBe(
        toCents(totalCad),
      );
      expect(toCents(totalCad)).toBe(Math.round(amountCad * rec.centsPerDollar));
    }
  });

  it("omits fuel assumptions when no per-litre benefit applies", () => {
    const rec = recommendCardsForMerchant({
      merchantBrandId: "loblaws",
      category: "groceries",
      ownedCardIds: ["pc-financial-we"],
    })[0]!;
    const { assumptions } = buildValueBreakdown(rec.valueComponents, 80, 1.5);
    expect(assumptions.cadPerLitre).toBeNull();
    expect(assumptions.litres).toBeNull();
  });
});
