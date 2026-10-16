import { describe, expect, it } from "vitest";
import { checkExtraction } from "../checks";
import {
  COBALT_PAGE,
  MOMENTUM_PAGE,
  TANGERINE_MCC_PAGE,
  WELCOME_DATED_PAGE,
  cobaltSharedCapExtraction,
  momentumTierExtraction,
  tangerineMccExtraction,
  welcomeDatedExtraction,
} from "../test/card-rules-fixtures";
import { GOLD_PAGE_TEXT, goldExtraction } from "../test/fixtures";

describe("card rules fixtures (MC2)", () => {
  it("extracts an MCC list from Tangerine-style terms", () => {
    const extraction = tangerineMccExtraction();
    const groceries = extraction.earn_rates.find((e) => e.category === "groceries")!;
    expect(groceries).toMatchObject({
      mccs: ["5411", "5422", "5499"],
      mcc_source: "terms",
      exclusions: ["warehouse clubs", "gift cards"],
      source_url: expect.stringContaining("tangerine"),
    });
    expect(checkExtraction(extraction, TANGERINE_MCC_PAGE).ok).toBe(true);
  });

  it("extracts named merchants from Scotiabank Gold Amex-style terms", () => {
    const extraction = goldExtraction();
    const groceries = extraction.earn_rates.find((e) => e.category === "groceries")!;
    expect(groceries.merchants).toEqual(["Sobeys", "Safeway", "FreshCo"]);
    expect(groceries.mcc_source).toBe("terms");
    expect(groceries.mccs).toEqual([]);
    expect(checkExtraction(extraction, GOLD_PAGE_TEXT).ok).toBe(true);
  });

  it("extracts a shared cap from Amex Cobalt-style terms", () => {
    const extraction = cobaltSharedCapExtraction();
    const bonus = extraction.earn_rates.filter((e) => e.cap_group === "cobalt-5x");
    expect(bonus).toHaveLength(2);
    expect(bonus.map((e) => e.category).sort()).toEqual(["dining", "groceries"]);
    for (const e of bonus) {
      expect(e).toMatchObject({
        cap_amount: 2500,
        cap_period: "monthly",
        rate_after_cap: 1,
        mcc_source: "network_default",
      });
    }
    expect(bonus[0]!.exclusions).toEqual(expect.arrayContaining(["Superstores", "warehouse clubs"]));
    expect(checkExtraction(extraction, COBALT_PAGE).ok).toBe(true);
  });

  it("extracts a spend tier threshold", () => {
    const extraction = momentumTierExtraction();
    const groceries = extraction.earn_rates.find((e) => e.category === "groceries")!;
    expect(groceries).toMatchObject({
      rate: 4,
      tier_threshold: 25000,
      exclusions: ["Gift cards"],
      mcc_source: "network_default",
    });
    expect(checkExtraction(extraction, MOMENTUM_PAGE).ok).toBe(true);
  });

  it("extracts a welcome offer with dates and a dated promotion", () => {
    const extraction = welcomeDatedExtraction();
    expect(extraction.welcome_bonus?.value).toMatchObject({
      points: 30000,
      valid_from: "2026-01-01",
      valid_to: "2026-03-31",
      new_cardholders_only: true,
    });
    expect(extraction.promotions[0]).toMatchObject({
      rate: 10,
      categories: ["groceries"],
      valid_from: "2026-03-01",
      valid_to: "2026-03-31",
      source_url: expect.stringContaining("americanexpress"),
    });
    expect(checkExtraction(extraction, WELCOME_DATED_PAGE).ok).toBe(true);
  });
});
