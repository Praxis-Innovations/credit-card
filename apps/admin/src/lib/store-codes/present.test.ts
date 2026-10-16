import { describe, expect, it } from "vitest";
import {
  appTellsUsersCopy,
  certaintyCounts,
  codeDisplay,
  filterStoreCodes,
  needsEvidence,
  presentEvidenceList,
  wikidataFromNotes,
} from "./present";
import type { EvidenceRow, MerchantBrandRow, StoreCodeListItem } from "./types";

const brand = (over: Partial<MerchantBrandRow> = {}): MerchantBrandRow => ({
  id: "walmart",
  name: "Walmart",
  category: "groceries",
  notes: "wikidata:Q483551",
  source_url: "https://example.com",
  last_verified: "2026-10-15",
  status: "pending",
  mcc: "5411",
  amex_mcc: null,
  certainty: "varies_by_network",
  reviewed_by: null,
  ...over,
});

const evidence = (over: Partial<EvidenceRow> = {}): EvidenceRow => ({
  id: "e1",
  merchant_brand_id: "walmart",
  chain: "Walmart",
  mcc: "5411",
  network: "mastercard",
  channel: "in_store",
  source_type: "cardholder_report",
  url: "https://example.com/thread",
  quote: "MCC is 5411",
  observed_date: "2026-10-15",
  statement_text: null,
  location: null,
  format: "Supercentre",
  store_number: null,
  city: null,
  card_id: null,
  screenshot_path: null,
  mcc_shown: null,
  category_shown: null,
  created_at: "2026-10-15T00:00:00Z",
  ...over,
});

const listItem = (over: Partial<StoreCodeListItem> = {}): StoreCodeListItem => ({
  ...brand(),
  code_display: "5411",
  category_label: "Groceries",
  evidence_count: 2,
  latest_evidence_label: "Oct 15, 2026 · Cardholder report",
  needs_evidence: false,
  pending_review: false,
  ...over,
});

describe("needsEvidence", () => {
  it("is true below the confirmed threshold", () => {
    expect(needsEvidence(0)).toBe(true);
    expect(needsEvidence(1)).toBe(true);
    expect(needsEvidence(2)).toBe(false);
  });
});

describe("codeDisplay", () => {
  it("joins distinct brand and evidence codes", () => {
    expect(codeDisplay(brand({ mcc: "5411", amex_mcc: "5310" }), [evidence({ mcc: "5310" })])).toBe(
      "5310 or 5411",
    );
  });
});

describe("filterStoreCodes", () => {
  it("filters by certainty chip, category and search", () => {
    const rows = [
      listItem({ name: "Loblaws", certainty: "confirmed", category: "groceries", mcc: "5411" }),
      listItem({
        id: "shell",
        name: "Shell",
        certainty: "confirmed",
        category: "gas",
        mcc: "5542",
        code_display: "5542",
        needs_evidence: false,
      }),
      listItem({
        id: "rona",
        name: "Rona",
        certainty: "estimate",
        evidence_count: 1,
        needs_evidence: true,
        code_display: "5251",
        mcc: "5251",
      }),
    ];
    expect(filterStoreCodes(rows, { query: "", category: "", certainty: "needs_evidence" })).toHaveLength(
      1,
    );
    expect(filterStoreCodes(rows, { query: "5542", category: "", certainty: "all" })[0]?.name).toBe(
      "Shell",
    );
    expect(filterStoreCodes(rows, { query: "", category: "gas", certainty: "all" })).toHaveLength(1);
  });
});

describe("certaintyCounts", () => {
  it("counts varies_* together and needs_evidence separately", () => {
    const counts = certaintyCounts([
      listItem({ certainty: "confirmed", needs_evidence: false }),
      listItem({ id: "a", certainty: "varies_by_store", needs_evidence: true }),
      listItem({ id: "b", certainty: "estimate", needs_evidence: true }),
    ]);
    expect(counts.all).toBe(3);
    expect(counts.confirmed).toBe(1);
    expect(counts.varies).toBe(1);
    expect(counts.estimate).toBe(1);
    expect(counts.needs_evidence).toBe(2);
  });
});

describe("appTellsUsersCopy", () => {
  it("mentions store and card when certainty varies by network", () => {
    const copy = appTellsUsersCopy(brand(), [evidence()]);
    expect(copy).toContain("Walmart");
    expect(copy.toLowerCase()).toContain("card");
  });
});

describe("presentEvidenceList", () => {
  it("flags conflicting MCC for the same format and network", () => {
    const list = presentEvidenceList([
      evidence({ id: "a", mcc: "5411" }),
      evidence({
        id: "b",
        mcc: "5310",
        source_type: "blog",
        url: "https://blog.example.com/mcc",
        quote: "5310",
      }),
    ]);
    expect(list.some((e) => e.conflict_note)).toBe(true);
  });
});

describe("wikidataFromNotes", () => {
  it("parses wikidata ids from brand notes", () => {
    expect(wikidataFromNotes("wikidata:Q483551")).toBe("Q483551");
    expect(wikidataFromNotes(null)).toBeNull();
  });
});
