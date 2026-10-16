import { describe, expect, it } from "vitest";
import { checkExtraction, normaliseForMatch, numberInQuote, numbersIn, quoteInText, stringInQuote } from "./checks";
import { GOLD_PAGE_TEXT, goldExtraction } from "./test/fixtures";

const page = normaliseForMatch(GOLD_PAGE_TEXT);

describe("quoteInText", () => {
  it("matches verbatim quotes across line breaks, list markers, table pipes and trademark marks", () => {
    expect(quoteInText("Annual fee $120 /year", page)).toBe(true);
    expect(quoteInText("Scotiabank Gold American Express Card", page)).toBe(true);
    expect(quoteInText("Travel Emergency Medical Insurance up to $1,000,000", page)).toBe(true);
    expect(quoteInText("You have a minimum personal income of $12,000 per year", page)).toBe(true);
    expect(quoteInText("Earn 5 Scene+ points on every $1 you spend on eligible dining and entertainment.", page)).toBe(true);
  });

  it("rejects paraphrases, ellipses, changed numbers and empty quotes", () => {
    expect(quoteInText("The annual fee is $120", page)).toBe(false);
    expect(quoteInText("Earn 6 Scene+ points ... FreshCo", page)).toBe(false);
    expect(quoteInText("Purchase interest rate 19.99%", page)).toBe(false);
    expect(quoteInText("   ", page)).toBe(false);
  });

  it("is case-sensitive (verbatim)", () => {
    expect(quoteInText("annual FEE $120", page)).toBe(false);
  });
});

describe("value-in-quote", () => {
  it("parses money, percentages and thousands", () => {
    expect(numbersIn("$1,200 or 20.99% or 60K or $0")).toEqual([1200, 20.99, 60000, 0]);
  });

  it("accepts 0 for 'no fee' wording", () => {
    expect(numberInQuote(0, "No foreign transaction fees")).toBe(true);
    expect(numberInQuote(0, "Annual fee $0")).toBe(true);
    expect(numberInQuote(0, "Annual fee $99")).toBe(false);
  });

  it("matches strings loosely (case, symbols) with network aliases", () => {
    expect(stringInQuote("Scotiabank Gold American Express Card", "Scotiabank Gold American Express® Card")).toBe(true);
    expect(stringInQuote("American Express", "Scotiabank Gold Amex Card")).toBe(true);
    expect(stringInQuote("Visa", "Scotiabank Gold Amex Card")).toBe(false);
  });

  it("treats big-bank legal names as aliases of the catalog issuer", () => {
    expect(
      stringInQuote(
        "Scotiabank",
        "This credit card program is issued and administered by the Bank of Nova Scotia under license from American Express.",
      ),
    ).toBe(true);
    expect(stringInQuote("Scotiabank", "Registered trademarks of The Bank of Nova Scotia.")).toBe(true);
    expect(stringInQuote("RBC", "Issued by Royal Bank of Canada")).toBe(true);
    expect(stringInQuote("TD", "The Toronto-Dominion Bank")).toBe(true);
    expect(stringInQuote("BMO", "Bank of Montreal")).toBe(true);
    expect(stringInQuote("CIBC", "Canadian Imperial Bank of Commerce")).toBe(true);
    expect(stringInQuote("National Bank", "National Bank of Canada")).toBe(true);
    expect(stringInQuote("Scotiabank", "Issued by Royal Bank of Canada", { issuerAliases: true })).toBe(false);
    expect(stringInQuote("Scotiabank", "Bank of Nova Scotia", { issuerAliases: false })).toBe(false);
  });
});

describe("issuer field check", () => {
  it("passes when the quote uses the legal name for an aliased catalog issuer", () => {
    const result = checkExtraction(
      goldExtraction({
        issuer: {
          value: "Scotiabank",
          quote: "This credit card program is issued and administered by the Bank of Nova Scotia under license from American Express.",
        },
      }),
      `${GOLD_PAGE_TEXT}\nThis credit card program is issued and administered by the Bank of Nova Scotia under license from American Express.`,
    );
    expect(result.fields.find((f) => f.field === "issuer")).toMatchObject({
      quote_found: true,
      value_in_quote: true,
      ok: true,
    });
  });
});

describe("checkExtraction", () => {
  it("passes a faithful extraction", () => {
    const result = checkExtraction(goldExtraction(), GOLD_PAGE_TEXT);
    expect(result.fields.filter((f) => !f.ok)).toEqual([]);
    expect(result).toMatchObject({ ok: true, flagged: 0 });
    expect(result.total).toBe(14);
  });

  it("flags (does not drop) a quote that is not on the page", () => {
    const extraction = goldExtraction({ annual_fee: { value: 120, quote: "The annual fee is $120" } });
    const result = checkExtraction(extraction, GOLD_PAGE_TEXT);
    expect(result.ok).toBe(false);
    expect(result.fields.find((f) => f.field === "annual_fee")).toMatchObject({
      quote_found: false,
      value_in_quote: true,
      ok: false,
      issues: ["quote not found verbatim in page text"],
    });
    expect(extraction.annual_fee?.value).toBe(120);
  });

  it("flags a value that is not in its quote", () => {
    const result = checkExtraction(
      goldExtraction({ purchase_apr: { value: 19.99, quote: "Purchase interest rate 21.99%" } }),
      GOLD_PAGE_TEXT,
    );
    expect(result.fields.find((f) => f.field === "purchase_apr")).toMatchObject({
      quote_found: true,
      value_in_quote: false,
      issues: ["value does not appear in its quote"],
    });
  });

  it("flags out-of-range fees, APRs and earn rates", () => {
    const text = `${GOLD_PAGE_TEXT}\nAnnual fee $1,200\nInterest 45.5%\nEarn 50 points per $1`;
    const result = checkExtraction(
      goldExtraction({
        annual_fee: { value: 1200, quote: "Annual fee $1,200" },
        purchase_apr: { value: 45.5, quote: "Interest 45.5%" },
        earn_rates: [
          {
            category: "other",
            description: "",
            rate: 50,
            unit: "points_per_dollar",
            cap: null,
            quote: "Earn 50 points per $1",
            mccs: [],
            merchants: [],
            mcc_source: "network_default",
            exclusions: [],
            cap_amount: null,
            cap_period: null,
            cap_group: null,
            rate_after_cap: null,
            tier_threshold: null,
            valid_from: null,
            valid_to: null,
            source_url: null,
          },
        ],
      }),
      text,
    );
    const bad = Object.fromEntries(result.fields.filter((f) => !f.ok).map((f) => [f.field, f.in_range]));
    expect(bad).toEqual({ annual_fee: false, purchase_apr: false, "earn_rates[0] other": false });
  });

  it("flags a missing card name and welcome-bonus numbers not in the quote", () => {
    const result = checkExtraction(
      goldExtraction({
        card_name: null,
        welcome_bonus: {
          value: {
            summary: "bonus",
            points: 60000,
            cashback_cad: null,
            rate: null,
            valid_from: null,
            valid_to: null,
            new_cardholders_only: null,
          },
          quote: "Earn up to 50,000 bonus Scene+ points in your first year.",
        },
      }),
      GOLD_PAGE_TEXT,
    );
    expect(result.fields.filter((f) => !f.ok).map((f) => f.field)).toEqual(["card_name", "welcome_bonus"]);
  });
});
