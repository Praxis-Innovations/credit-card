import { describe, expect, it } from "vitest";
import { coerceExtraction, stampSourceUrl, toIsoDate } from "./schema";

const RICH_EARN = {
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
};

describe("card rules earn coercion", () => {
  it("keeps MCC / cap / tier fields and stamps source_url", () => {
    const extraction = stampSourceUrl(
      coerceExtraction({
        card_name: { value: "X", quote: "X" },
        earn_rates: [RICH_EARN],
        insurance_highlights: [],
        notes: null,
      }),
      "https://issuer.example/card",
    );
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
  });

  it("defaults mcc_source to network_default when only a category is named", () => {
    const extraction = coerceExtraction({
      earn_rates: [{ ...RICH_EARN, mccs: [], merchants: [], mcc_source: undefined }],
    });
    expect(extraction.earn_rates[0]!.mcc_source).toBe("network_default");
  });
});

describe("card rules offer coercion", () => {
  it("keeps dated welcome bonuses and promotions", () => {
    const extraction = stampSourceUrl(
      coerceExtraction({
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
      }),
      "https://issuer.example/card",
    );
    expect(extraction.welcome_bonus?.value).toMatchObject({
      points: 30000,
      valid_from: "2026-01-01",
      valid_to: "2026-03-31",
      new_cardholders_only: true,
    });
    expect(extraction.promotions[0]).toMatchObject({
      summary: "Spring",
      rate: 10,
      categories: ["groceries"],
      valid_from: "2026-03-01",
      valid_to: "2026-03-31",
      source_url: "https://issuer.example/card",
    });
  });

  it("parses common date forms to ISO", () => {
    expect(toIsoDate("2026-03-31")).toBe("2026-03-31");
    expect(toIsoDate("March 31, 2026")).toBe("2026-03-31");
    expect(toIsoDate("")).toBeNull();
  });
});
