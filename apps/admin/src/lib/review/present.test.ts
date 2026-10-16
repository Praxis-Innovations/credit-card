import { describe, expect, it } from "vitest";
import { buildFieldRows, changedFieldCount, failedCheckCount, splitFieldRows } from "./present";
import type { CheckResult, DiffResult, Extraction } from "./types";

const extracted: Extraction = {
  card_name: { value: "Gold Amex", quote: "Scotiabank Gold American Express" },
  annual_fee: { value: 120, quote: "Annual fee: $120" },
  earn_rates: [
    { category: "groceries", rate: 6, unit: "points_per_dollar", quote: "6x at Sobeys" },
    { category: "other", rate: 1, unit: "points_per_dollar", quote: "1x on everything else" },
  ],
};

const checks: CheckResult = {
  ok: false,
  total: 4,
  flagged: 1,
  fields: [
    { field: "card_name", quote_found: true, value_in_quote: true, in_range: null, ok: true, issues: [] },
    { field: "annual_fee", quote_found: true, value_in_quote: true, in_range: true, ok: true, issues: [] },
    { field: "earn_rates[0] groceries", quote_found: false, value_in_quote: true, in_range: true, ok: false, issues: ["quote not found verbatim in page text"] },
    { field: "earn_rates[1] other", quote_found: true, value_in_quote: true, in_range: true, ok: true, issues: [] },
  ],
};

const diff: DiffResult = {
  kind: "changed",
  linked_card_id: "scotia-gold-amex",
  match: "linked",
  changes: [
    { field: "annual_fee", catalog: 99, extracted: 120, flagged: false },
    { field: "earn_rate.groceries", catalog: 5, extracted: 6, flagged: true },
  ],
};

describe("buildFieldRows", () => {
  it("puts changed fields first, beside the catalog value, quote and check", () => {
    const rows = buildFieldRows({ extracted, check_results: checks, diff });
    expect(rows.slice(0, 2)).toMatchObject([
      { key: "annual_fee", current: "99", proposed: "120", quote: "Annual fee: $120", changed: true, check: { ok: true } },
      { key: "earn_rate.groceries", current: "5", proposed: "6", quote: "6x at Sobeys", changed: true, check: { ok: false } },
    ]);
    expect(rows.slice(2).every((r) => !r.changed && r.current === null)).toBe(true);
  });

  it("treats every field of a new card as changed", () => {
    const rows = buildFieldRows({ extracted, check_results: checks, diff: { ...diff, kind: "new", changes: [] } });
    expect(rows.every((r) => r.changed)).toBe(true);
  });

  it("returns nothing for a possibly discontinued card", () => {
    expect(buildFieldRows({ extracted: null, check_results: null, diff: null })).toEqual([]);
  });
});

describe("splitFieldRows", () => {
  it("puts changes and failed checks in Needs a look, the rest in Looks right", () => {
    const { needsLook, looksRight } = splitFieldRows(buildFieldRows({ extracted, check_results: checks, diff }));
    expect(needsLook.map((r) => r.key)).toEqual(["annual_fee", "earn_rate.groceries"]);
    expect(looksRight.map((r) => r.key).sort()).toEqual(["earn_rate.other", "name"]);
  });
});

describe("counts", () => {
  it("counts diff changes for a changed card and all fields for a new one", () => {
    expect(changedFieldCount({ extracted, check_results: checks, diff })).toBe(2);
    expect(
      changedFieldCount({ extracted, check_results: checks, diff: { ...diff, kind: "new", changes: [] } }),
    ).toBe(buildFieldRows({ extracted, check_results: checks, diff: { ...diff, kind: "new", changes: [] } }).length);
  });

  it("counts failed checks, falling back to the stored flagged_count", () => {
    expect(failedCheckCount({ check_results: checks, flagged_count: 0 })).toBe(1);
    expect(failedCheckCount({ check_results: null, flagged_count: 3 })).toBe(3);
  });
});

describe("card rule fields", () => {
  it("shows MCC lists, merchants, caps, tiers and dated welcome/promotions beside their quotes", () => {
    const rows = buildFieldRows({
      extracted: {
        card_name: { value: "Cobalt", quote: "Cobalt" },
        earn_rates: [
          {
            category: "groceries",
            rate: 5,
            unit: "points_per_dollar",
            quote: "5x groceries up to $2,500 monthly; MCC 5411; not warehouse clubs",
            mccs: ["5411"],
            merchants: [],
            mcc_source: "terms",
            exclusions: ["warehouse clubs"],
            cap_amount: 2500,
            cap_period: "monthly",
            cap_group: "cobalt-5x",
            rate_after_cap: 1,
            source_url: "https://example.com/cobalt",
          },
          {
            category: "groceries",
            rate: 4,
            unit: "percent_cashback",
            quote: "4% after $25,000 annual spend",
            description: "tier",
            mcc_source: "network_default",
            tier_threshold: 25000,
          },
        ],
        welcome_bonus: {
          value: {
            summary: "30k",
            points: 30000,
            valid_from: "2026-01-01",
            valid_to: "2026-03-31",
            new_cardholders_only: true,
          },
          quote: "30,000 points for new cardmembers through March 31, 2026",
        },
        promotions: [
          {
            summary: "Spring grocery",
            rate: 10,
            points: null,
            categories: ["groceries"],
            valid_from: "2026-03-01",
            valid_to: "2026-03-31",
            quote: "10x groceries in March",
            source_url: "https://example.com/offers",
          },
        ],
      },
      check_results: null,
      diff: { kind: "new", linked_card_id: null, match: null, changes: [] },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey["earn_rates[0].mccs"]).toMatchObject({
      proposed: "5411",
      quote: expect.stringContaining("5411"),
      label: expect.stringContaining("MCCs"),
    });
    expect(byKey["earn_rates[0].cap_group"]).toMatchObject({ proposed: "cobalt-5x" });
    expect(byKey["earn_rates[1].tier_threshold"]).toMatchObject({ proposed: "25000" });
    expect(byKey["welcome_bonus.valid_to"]).toMatchObject({ proposed: "2026-03-31" });
    expect(byKey["welcome_bonus.new_cardholders_only"]).toMatchObject({ proposed: "yes" });
    expect(byKey["promotion.0.valid_to"]).toMatchObject({ proposed: "2026-03-31" });
  });
});
