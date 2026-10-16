import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkExtraction, numberInQuote } from "./checks";
import type { CardExtraction } from "./extract/schema";
import { isRateCell, selectQuoteSpans, widenQuoteToContainNumber } from "./quote-span";
import { earnRate } from "./test/fixtures";

const CR2_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "test/cr2-scotiabank");

const TABLE_PAGE = `Scene+ points

on everyday purchases

6 points

At Sobeys, Safeway, FreshCo, Foodland and more.

5 points

On dining, food delivery, food subscriptions, and other eligible grocery stores.

Purchase interest rate

21.99%

Cash advance rate

22.99%

Your cash advance rate applies to advances, balance transfers, and cash-like transactions.
`;

describe("isRateCell", () => {
  it("accepts short rate cells and rejects descriptions", () => {
    expect(isRateCell("6 points")).toBe(true);
    expect(isRateCell("22.99%")).toBe(true);
    expect(isRateCell("Up to 4 points")).toBe(true);
    expect(isRateCell("At Sobeys, Safeway, FreshCo, Foodland and more.")).toBe(false);
    expect(isRateCell("Your cash advance rate applies to advances.")).toBe(false);
  });
});

describe("widenQuoteToContainNumber", () => {
  it("widens an earn-rate description to the table row that holds the rate", () => {
    const quote = "At Sobeys, Safeway, FreshCo, Foodland and more.";
    const widened = widenQuoteToContainNumber(quote, 6, TABLE_PAGE);
    expect(widened).toContain("6 points");
    expect(widened).toContain(quote);
    expect(numberInQuote(6, widened)).toBe(true);
  });

  it("pairs with the rate cell above so a wrong rate stays flagged", () => {
    const quote = "At Sobeys, Safeway, FreshCo, Foodland and more.";
    const widened = widenQuoteToContainNumber(quote, 5, TABLE_PAGE);
    expect(widened).toContain("6 points");
    expect(numberInQuote(5, widened)).toBe(false);
  });

  it("widens a balance-transfer APR note to include the cash-advance rate above", () => {
    const quote = "Your cash advance rate applies to advances, balance transfers, and cash-like transactions.";
    const widened = widenQuoteToContainNumber(quote, 22.99, TABLE_PAGE);
    expect(widened).toContain("22.99%");
    expect(numberInQuote(22.99, widened)).toBe(true);
  });

  it("still pairs a description with its rate cell when the value is absent (check flags it)", () => {
    const quote = "At Sobeys, Safeway, FreshCo, Foodland and more.";
    const widened = widenQuoteToContainNumber(quote, 99, TABLE_PAGE);
    expect(widened).toContain("6 points");
    expect(numberInQuote(99, widened)).toBe(false);
  });

  it("leaves the quote unchanged when there is no nearby rate cell or number", () => {
    const page = "Welcome to our card.\n\nEligible purchases earn rewards.\n\nSee terms for details.\n";
    const quote = "Eligible purchases earn rewards.";
    expect(widenQuoteToContainNumber(quote, 99, page)).toBe(quote);
    expect(numberInQuote(99, quote)).toBe(false);
  });

  it("does not confirm a wrong rate by borrowing a neighbouring row's number", () => {
    const page = `Earn 5 points on dining

Earn 3 points on gas

Other purchases earn rewards.
`;
    const quote = "Other purchases earn rewards.";
    // Claude claimed 3 (from the gas row) for "other"; real rate is 1.
    const widened = widenQuoteToContainNumber(quote, 3, page);
    expect(widened).toBe(quote);
    expect(numberInQuote(3, widened)).toBe(false);

    const extraction: CardExtraction = {
      card_name: null,
      issuer: null,
      network: null,
      annual_fee: null,
      additional_card_fee: null,
      purchase_apr: null,
      cash_advance_apr: null,
      balance_transfer_apr: null,
      fx_fee_percent: null,
      min_personal_income: null,
      min_household_income: null,
      min_credit_limit: null,
      reward_currency: null,
      earn_rates: [
        earnRate({
          category: "other",
          description: "other purchases",
          rate: 3,
          unit: "points_per_dollar",
          cap: null,
          quote,
        }),
      ],
      welcome_bonus: null,
      promotions: [],
      insurance_highlights: [],
      notes: null,
    };
    const checks = checkExtraction(selectQuoteSpans(extraction, page), page);
    expect(checks.fields.find((f) => f.field === "earn_rates[0] other")).toMatchObject({
      value_in_quote: false,
      ok: false,
      issues: ["value does not appear in its quote"],
    });
  });
});

describe("selectQuoteSpans", () => {
  it("rewrites earn_rates and balance_transfer_apr quotes only", () => {
    const extraction: CardExtraction = {
      card_name: { value: "Gold", quote: "Gold" },
      issuer: { value: "Scotiabank", quote: "Bank of Nova Scotia" },
      network: null,
      annual_fee: null,
      additional_card_fee: null,
      purchase_apr: null,
      cash_advance_apr: null,
      balance_transfer_apr: {
        value: 22.99,
        quote: "Your cash advance rate applies to advances, balance transfers, and cash-like transactions.",
      },
      fx_fee_percent: null,
      min_personal_income: null,
      min_household_income: null,
      min_credit_limit: null,
      reward_currency: null,
      earn_rates: [
        earnRate({
          category: "groceries",
          description: "Sobeys",
          rate: 6,
          unit: "points_per_dollar",
          cap: null,
          quote: "At Sobeys, Safeway, FreshCo, Foodland and more.",
        }),
      ],
      welcome_bonus: null,
      promotions: [],
      insurance_highlights: [],
      notes: null,
    };
    const out = selectQuoteSpans(extraction, TABLE_PAGE);
    expect(out.issuer?.quote).toBe(extraction.issuer?.quote);
    expect(numberInQuote(6, out.earn_rates[0]!.quote)).toBe(true);
    expect(numberInQuote(22.99, out.balance_transfer_apr!.quote)).toBe(true);
  });
});

describe("CR2 Scotiabank saved-page re-run", () => {
  function loadCr2(): Array<{ slug: string; page: string; extracted: CardExtraction }> {
    return readdirSync(path.join(CR2_ROOT, "extractions"))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => {
        const slug = f.replace(/\.json$/, "");
        const extracted = JSON.parse(readFileSync(path.join(CR2_ROOT, "extractions", f), "utf8")).extracted as CardExtraction;
        const page = readFileSync(path.join(CR2_ROOT, "pages", `${slug}.txt`), "utf8");
        return { slug, page, extracted };
      });
  }

  function countFlags(
    cards: Array<{ page: string; extracted: CardExtraction }>,
    mode: "before" | "after",
  ): { issuer: number; earn: number; bt: number; total: number } {
    let issuer = 0;
    let earn = 0;
    let bt = 0;
    let total = 0;
    for (const card of cards) {
      const extraction = mode === "after" ? selectQuoteSpans(card.extracted, card.page) : card.extracted;
      const checks = checkExtraction(extraction, card.page, {
        issuerAliases: mode === "after",
      });
      for (const f of checks.fields) {
        if (f.ok) continue;
        total++;
        if (f.field === "issuer") issuer++;
        else if (f.field.startsWith("earn_rates")) earn++;
        else if (f.field === "balance_transfer_apr") bt++;
      }
    }
    return { issuer, earn, bt, total };
  }

  it("cuts false issuer, earn-rate and BT APR flags without a new live crawl", () => {
    const cards = loadCr2();
    expect(cards).toHaveLength(17);

    const before = countFlags(cards, "before");
    const after = countFlags(cards, "after");

    // CR2 report on #34: 16/17 issuer, 41/83 earn-rate, 10 BT APR, 74 overall.
    // After: issuer aliases + quote-span widening; remaining 7 are real issues.
    expect({ before, after }).toEqual({
      before: { issuer: 16, earn: 41, bt: 10, total: 74 },
      after: { issuer: 0, earn: 0, bt: 0, total: 7 },
    });
  });
});
