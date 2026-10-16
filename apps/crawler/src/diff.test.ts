import { describe, expect, it } from "vitest";
import { checkExtraction } from "./checks";
import { diffCard, findPossiblyDiscontinued, normaliseCardName, reviewStatusFor } from "./diff";
import { CATALOG, GOLD_PAGE_TEXT, goldExtraction } from "./test/fixtures";

describe("normaliseCardName", () => {
  it.each([
    ["Scotiabank Gold American Express® Card", "Gold American Express"],
    ["Scotiabank® Scene+TM Visa* Card", "Scene+ Visa"],
    ["Scotia Momentum® Visa Infinite +* Card", "Momentum Visa Infinite"],
    ["Scotiabank Passport™ Visa Infinite* Card", "Passport Visa Infinite"],
  ])("matches %s to the catalog name %s", (page, catalog) => {
    expect(normaliseCardName(page, "Scotiabank")).toBe(normaliseCardName(catalog, "Scotiabank"));
  });

  it("keeps student and no-fee variants distinct", () => {
    expect(normaliseCardName("Scotiabank Scene+ Visa Card for students", "Scotiabank")).not.toBe(
      normaliseCardName("Scene+ Visa", "Scotiabank"),
    );
    expect(normaliseCardName("Scotia Momentum No-Fee Visa Card", "Scotiabank")).not.toBe(
      normaliseCardName("Momentum Visa", "Scotiabank"),
    );
  });
});

describe("diffCard", () => {
  it("reports changed fields against the matched catalog card", () => {
    const extraction = goldExtraction();
    const diff = diffCard(extraction, checkExtraction(extraction, GOLD_PAGE_TEXT), CATALOG, "Scotiabank", null);
    expect(diff).toMatchObject({ kind: "changed", linked_card_id: "scotia-gold-amex", match: "name" });
    expect(diff.changes).toEqual([
      { field: "earn_rate.groceries", catalog: 5, extracted: 6, flagged: false },
      { field: "welcome_bonus.points", catalog: 40000, extracted: 50000, flagged: false },
    ]);
  });

  it("uses the page's base rate for categories it does not list", () => {
    const extraction = goldExtraction({
      welcome_bonus: null,
      earn_rates: goldExtraction().earn_rates.map((e) => (e.category === "groceries" ? { ...e, rate: 5 } : e)),
    });
    const diff = diffCard(extraction, null, CATALOG, "Scotiabank", null);
    expect(diff).toMatchObject({ kind: "unchanged", changes: [] });
  });

  it("marks a change as flagged when the extracted value failed its checks", () => {
    const extraction = goldExtraction({ annual_fee: { value: 150, quote: "Annual fee $150" } });
    const diff = diffCard(extraction, checkExtraction(extraction, GOLD_PAGE_TEXT), CATALOG, "Scotiabank", null);
    expect(diff.changes[0]).toEqual({ field: "annual_fee", catalog: 120, extracted: 150, flagged: true });
  });

  it("reports a card with no catalog match as new", () => {
    const extraction = goldExtraction({ card_name: { value: "Scotiabank Platinum Amex Card", quote: "x" } });
    expect(diffCard(extraction, null, CATALOG, "Scotiabank", null)).toMatchObject({ kind: "new", linked_card_id: null });
  });

  it("prefers an admin-linked catalog id over the name and reports a name change", () => {
    const extraction = goldExtraction({
      card_name: { value: "Scotiabank Scene+ Visa Card for students", quote: "x" },
      annual_fee: { value: 0, quote: "$0" },
      network: { value: "Visa", quote: "Visa" },
      earn_rates: [],
      welcome_bonus: null,
    });
    const diff = diffCard(extraction, null, CATALOG, "Scotiabank", "scotia-scene-visa");
    expect(diff).toMatchObject({ kind: "changed", linked_card_id: "scotia-scene-visa", match: "linked" });
    expect(diff.changes.map((c) => c.field)).toEqual(["name"]);
  });

  it("returns a null kind when no catalog is available", () => {
    expect(diffCard(goldExtraction(), null, null, "Scotiabank", null)).toMatchObject({ kind: null, changes: [] });
  });
});

describe("reviewStatusFor", () => {
  it("stores a finding with no changes as checked", () => {
    expect(reviewStatusFor("unchanged")).toBe("checked");
  });

  it.each(["new", "changed", "possibly_discontinued", null] as const)("queues %s for review", (kind) => {
    expect(reviewStatusFor(kind)).toBe("pending");
  });
});

describe("findPossiblyDiscontinued", () => {
  it("lists catalog cards no page matched", () => {
    expect(findPossiblyDiscontinued(CATALOG, new Set(["scotia-gold-amex"])).map((c) => c.id)).toEqual(["scotia-scene-visa"]);
  });
});
