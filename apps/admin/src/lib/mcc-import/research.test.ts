import { describe, expect, it } from "vitest";
import { chainFromStatement, parseResearchCsv } from "./research";

describe("parseResearchCsv store_codes", () => {
  it("builds writes and rejects bad rows", () => {
    const csv = [
      "chain,wikidata_id,mcc,network,channel,certainty,source_type,url,observed_date,quote",
      'Rona,,5200,visa,in_store,confirmed,blog,https://example.com/r,2026-01-01,"Rona codes as 5200"',
      "Bad,,52,visa,in_store,confirmed,blog,https://example.com/b,2026-01-01,nope",
    ].join("\n");

    const { writes, rejected } = parseResearchCsv("store_codes", csv);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.idempotencyKey).toBe("rona|https://example.com/r|visa|in_store");
    expect(writes[0]?.proposed.mcc).toBe("5200");
    expect(rejected).toEqual([{ row: 3, reason: "mcc must be a 4-digit code" }]);
  });
});

describe("chainFromStatement", () => {
  it("pulls chain and store number", () => {
    expect(chainFromStatement("WAL-MART SUPERCENTER #3124 TORONTO ON")).toMatchObject({
      store_number: "3124",
      city: "TORONTO",
    });
  });
});
