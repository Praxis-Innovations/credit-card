import { describe, expect, it } from "vitest";
import { checkExtraction } from "../checks";
import {
  COBALT_PAGE,
  GOLD_PAGE_TEXT,
  MOMENTUM_PAGE,
  TANGERINE_MCC_PAGE,
  WELCOME_DATED_PAGE,
  cobaltSharedCapExtraction,
  goldExtraction,
  momentumTierExtraction,
  tangerineMccExtraction,
  welcomeDatedExtraction,
} from "../test/fixtures";
import { coerceExtraction, stampSourceUrl, toIsoDate } from "./schema";

describe("card rules coercion", () => {
  it("keeps MCC lists, merchants, exclusions, caps, tiers and dates", () => {
    const raw = {
      card_name: { value: "X", quote: "X" },
      earn_rates: [
        {
          category: "groceries",
          description: "Sobeys",
          rate: 6,
          unit: "points_per_dollar",
          cap: null,
          quote: "6 at Sobeys MCC 5411",
          mccs: ["5411", "54xx"],
          merchants: ["Sobeys"],
          mcc_source: "terms",
          exclusions: ["gift cards"],
          cap_amount: 2500,
          cap_period: "monthly",
          cap_group: "shared",
          rate_after_cap: 1,
          tier_threshold: 25000,
          valid_from: "2026-01-01",
          valid_to: "March 31, 2026",
        },
      ],
      welcome_bonus: {
        value: {
          summary: "30k",
          points: 30000,
          cashback_cad: null,
          rate: null,
          valid_from: "2026-01-01",
          valid_to: "2026-03-31",
          new_cardholders_only: true,
        },
        quote: "30,000 for new cardmembers",
      },
      promotions: [
        {
          summary: "Spring",
          rate: 10,
          points: null,
          categories: ["groceries", "pets"],
          valid_from: "2026-03-01",
          valid_to: "2026-03-31",
          quote: "10x groceries",
        },
      ],
      insurance_highlights: [],
      notes: null,
    };
    const extraction = stampSourceUrl(coerceExtraction(raw), "https://issuer.example/card");
    expect(extraction.earn_rates[0]).toMatchObject({
      mccs: ["5411"],
      merchants: ["Sobeys"],
      mcc_source: "terms",
      exclusions: ["gift cards"],
      cap_amount: 2500,
      cap_period: "monthly",
      cap_group: "shared",
      rate_after_cap: 1,
      tier_threshold: 25000,
      valid_from: "2026-01-01",
      valid_to: "2026-03-31",
      source_url: "https://issuer.example/card",
    });
    expect(extraction.welcome_bonus?.value).toMatchObject({
      points: 30000,
      valid_from: "2026-01-01",
      valid_to: "2026-03-31",
      new_cardholders_only: true,
    });
    expect(extraction.promotions).toEqual([
      {
        summary: "Spring",
        rate: 10,
        points: null,
        categories: ["groceries"],
        valid_from: "2026-03-01",
        valid_to: "2026-03-31",
        quote: "10x groceries",
        source_url: "https://issuer.example/card",
      },
    ]);
  });

  it("defaults mcc_source to network_default when only a category is named", () => {
    const extraction = coerceExtraction({
      earn_rates: [
        {
          category: "dining",
          description: "restaurants",
          rate: 5,
          unit: "points_per_dollar",
          cap: null,
          quote: "5x restaurants",
          mccs: [],
          merchants: [],
          exclusions: [],
          cap_amount: null,
          cap_period: null,
          cap_group: null,
          rate_after_cap: null,
          tier_threshold: null,
          valid_from: null,
          valid_to: null,
        },
      ],
    });
    expect(extraction.earn_rates[0]!.mcc_source).toBe("network_default");
  });

  it("parses common date forms to ISO", () => {
    expect(toIsoDate("2026-03-31")).toBe("2026-03-31");
    expect(toIsoDate("March 31, 2026")).toBe("2026-03-31");
    expect(toIsoDate("")).toBeNull();
  });
});

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

  it("extracts a welcome offer with dates and new-cardholders-only, plus a dated promotion", () => {
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
