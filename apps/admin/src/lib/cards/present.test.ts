import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  buildCatalogFieldRows,
  catalogStatusPill,
  filterCards,
  imageRightsLabel,
  quotesFromExtraction,
  uniqueIssuers,
} from "./present";
import type { CatalogCard } from "./types";

const card = (over: Partial<CatalogCard> = {}): CatalogCard => ({
  id: "scotia-gold-amex",
  name: "Gold American Express",
  issuer: "Scotiabank",
  annual_fee: 120,
  point_currency: "Scene+",
  reward_categories: [
    { category: "groceries", earnRate: 5, capMonthly: 2500 },
    { category: "other", earnRate: 1 },
  ],
  welcome_offer: { summary: "Welcome bonus", estimatedValueCad: 200 },
  network: "Amex",
  tier: "Premium",
  last_verified: "2026-09-20",
  captured_at: "2026-09-20T00:00:00Z",
  verified_at: "2026-09-20T00:00:00Z",
  status: "verified",
  image_url: null,
  image_alt: null,
  image_source_url: null,
  image_rights_status: "generated",
  reviewed_by: null,
  ...over,
});

describe("catalogStatusPill", () => {
  it("maps each catalog status", () => {
    expect(catalogStatusPill("verified")).toEqual({ label: "Verified", tone: "ok" });
    expect(catalogStatusPill("rejected")).toEqual({ label: "Rejected", tone: "bad" });
    expect(catalogStatusPill("pending")).toEqual({ label: "Pending", tone: "warn" });
    expect(catalogStatusPill("stale")).toEqual({ label: "Stale", tone: "neutral" });
  });
});

describe("imageRightsLabel", () => {
  it("uses short labels for list and detail", () => {
    expect(imageRightsLabel("generated")).toBe("Generated");
    expect(imageRightsLabel("placeholder")).toBe("Placeholder");
  });
});

describe("filterCards", () => {
  const rows = [
    card(),
    card({ id: "amex-cobalt", name: "Cobalt", issuer: "American Express", status: "pending" }),
    card({ id: "td-cash", name: "Cash Back", issuer: "TD", status: "rejected" }),
  ];

  it("filters by search, issuer substring and status", () => {
    expect(filterCards(rows, { query: "gold", issuer: "", status: "all" }).map((c) => c.id)).toEqual([
      "scotia-gold-amex",
    ]);
    expect(filterCards(rows, { query: "", issuer: "amer", status: "all" }).map((c) => c.id)).toEqual([
      "amex-cobalt",
    ]);
    expect(filterCards(rows, { query: "", issuer: "", status: "rejected" }).map((c) => c.id)).toEqual([
      "td-cash",
    ]);
  });
});

describe("uniqueIssuers", () => {
  it("dedupes and sorts", () => {
    expect(uniqueIssuers([{ issuer: "TD" }, { issuer: "Scotiabank" }, { issuer: "TD" }])).toEqual([
      "Scotiabank",
      "TD",
    ]);
  });
});

describe("buildCatalogFieldRows", () => {
  it("includes earn caps and welcome offer, and attaches quotes when present", () => {
    const rows = buildCatalogFieldRows(card(), {
      card_name: { value: "Gold", quote: "Gold American Express Card" },
      annual_fee: { value: 120, quote: "$120 annual fee" },
      earn_rates: [{ category: "groceries", rate: 5, unit: "pts/$", quote: "5 points on groceries" }],
    });
    expect(rows.find((r) => r.key === "annual_fee")).toMatchObject({
      value: "$120",
      source: { quote: "$120 annual fee" },
    });
    expect(rows.find((r) => r.key === "earn_rate.groceries")).toMatchObject({
      value: "5 (cap $2500/mo)",
      source: { quote: "5 points on groceries" },
    });
    expect(rows.find((r) => r.key === "welcome_offer")?.value).toContain("Welcome bonus");
  });

  it("maps extraction quotes onto catalog keys", () => {
    const quotes = quotesFromExtraction({
      reward_currency: { value: "Scene+", quote: "earn Scene+" },
      network: { value: "Visa", quote: "Visa Infinite" },
    });
    expect(quotes.get("point_currency")).toBe("earn Scene+");
    expect(quotes.get("network")).toBe("Visa Infinite");
  });
});

describe("auditActionLabel", () => {
  it("humanizes known card actions", () => {
    expect(auditActionLabel("card.retire")).toBe("Retired");
    expect(auditActionLabel("card.approve_update")).toBe("Updated from review");
  });
});
