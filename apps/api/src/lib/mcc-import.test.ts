import { describe, expect, it } from "vitest";
import {
  createMemoryFindingStore,
  importMccCsv,
  parseStatementText,
  resolveCatalogCardName,
  validateAndBuildFindings,
} from "./mcc-import";

describe("parseStatementText", () => {
  it("parses Walmart Supercentre statement lines", () => {
    expect(parseStatementText("WAL-MART SUPERCENTER #3124 TORONTO ON")).toEqual({
      chain: "WAL-MART SUPERCENTER",
      storeNumber: "3124",
      city: "TORONTO",
      location: "TORONTO",
      format: "supercentre",
    });
  });
});

describe("resolveCatalogCardName", () => {
  it("matches exact catalog names", () => {
    expect(resolveCatalogCardName("Cobalt").cardId).toBe("amex-cobalt");
  });

  it("suggests close names when unknown", () => {
    const r = resolveCatalogCardName("Cobal");
    expect(r.cardId).toBeNull();
    expect(r.didYouMean.some((n) => /cobalt/i.test(n))).toBe(true);
  });
});

describe("validateAndBuildFindings", () => {
  it("rejects bad store_codes rows and keeps good ones", () => {
    const csv = [
      "chain,wikidata_id,mcc,network,channel,certainty,source_type,url,observed_date,quote",
      "Loblaws,Q1,5411,visa_mc,in_store,confirmed,issuer_merchant_list,https://example.com/a,2026-01-01,Loblaws 5411",
      "Bad,,99,visa_mc,in_store,confirmed,blog,https://example.com/b,2026-01-01,x",
    ].join("\n");
    const { writes, rejected } = validateAndBuildFindings("store_codes", csv);
    expect(writes).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatch(/mcc/);
  });

  it("is idempotent on re-import", async () => {
    const csv = [
      "mcc,name,source_url",
      "5411,Grocery Stores,https://example.com/mcc",
    ].join("\n");
    const store = createMemoryFindingStore();
    const first = await importMccCsv("mcc_codes", csv, store);
    const second = await importMccCsv("mcc_codes", csv, store);
    expect(first.inserted).toBe(1);
    expect(second.unchanged).toBe(1);
    expect(store.rows.size).toBe(1);
  });

  it("rejects unknown test-purchase cards with did-you-mean", () => {
    const csv = [
      "date,card,statement_text,mcc_shown,category_shown,screenshot_file",
      "2026-01-02,Not A Real Card,STORE #1 TORONTO ON,,,",
    ].join("\n");
    const { rejected } = validateAndBuildFindings("test_purchases", csv);
    expect(rejected[0]!.reason).toMatch(/did you mean|no close catalog match/);
  });

  it("never accepts card numbers in test purchases", () => {
    const csv = [
      "date,card,statement_text,mcc_shown,category_shown,screenshot_file",
      "2026-01-02,4111111111111111,STORE #1 TORONTO ON,,,",
    ].join("\n");
    const { rejected } = validateAndBuildFindings("test_purchases", csv);
    expect(rejected[0]!.reason).toMatch(/never a card number/);
  });
});
