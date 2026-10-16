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
    expect(changedFieldCount({ extracted, check_results: checks, diff: { ...diff, kind: "new", changes: [] } })).toBe(4);
  });

  it("counts failed checks, falling back to the stored flagged_count", () => {
    expect(failedCheckCount({ check_results: checks, flagged_count: 0 })).toBe(1);
    expect(failedCheckCount({ check_results: null, flagged_count: 3 })).toBe(3);
  });
});
