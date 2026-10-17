import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SUPABASE_PAGE_SIZE } from "@/lib/supabase/fetch-all";
import { loadStoreCodeList } from "./load";

type Page = { from: number; to: number };

/**
 * Fake PostgREST client that enforces the 1,000-row cap via `.range()` and
 * returns the requested brand / evidence slices.
 */
function cappedClient(brandCount: number, evidenceCount: number) {
  const ranges: Record<string, Page[]> = {
    merchant_brands: [],
    merchant_code_evidence: [],
    merchant_code_findings: [],
  };

  function tableData(table: string, from: number, to: number) {
    if (table === "merchant_brands") {
      const end = Math.min(to + 1, brandCount);
      return Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
        id: `brand-${from + i}`,
        name: `Chain ${String(from + i).padStart(4, "0")}`,
        category: "other",
        notes: null,
        source_url: "https://example.com",
        last_verified: "2026-10-15",
        status: "pending",
        mcc: null,
        amex_mcc: null,
        certainty: "unknown",
        reviewed_by: null,
      }));
    }
    if (table === "merchant_code_evidence") {
      const end = Math.min(to + 1, evidenceCount);
      return Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
        id: `ev-${from + i}`,
        merchant_brand_id: `brand-${(from + i) % brandCount}`,
        chain: `Chain ${String((from + i) % brandCount).padStart(4, "0")}`,
        mcc: "5411",
        network: "visa",
        channel: "in_store",
        source_type: "blog",
        url: "https://example.com/e",
        quote: "quote",
        observed_date: "2026-10-15",
        statement_text: null,
        location: null,
        format: null,
        store_number: null,
        city: null,
        card_id: null,
        screenshot_path: null,
        mcc_shown: null,
        category_shown: null,
        created_at: "2026-10-15T00:00:00Z",
      }));
    }
    return [];
  }

  function builder(table: string) {
    let from = 0;
    let to = SUPABASE_PAGE_SIZE - 1;
    const api: Record<string, unknown> = {};
    const chain = () => api;
    for (const method of ["select", "eq", "in", "order"]) {
      api[method] = () => chain();
    }
    api.range = (f: number, t: number) => {
      from = f;
      to = t;
      ranges[table]?.push({ from: f, to: t });
      return api;
    };
    api.returns = async () => {
      const data = tableData(table, from, to);
      // Simulate the server cap even if the client asked for more.
      return { data: data.slice(0, SUPABASE_PAGE_SIZE), error: null };
    };
    return api;
  }

  const client = {
    from: (table: string) => builder(table),
  } as unknown as SupabaseClient;

  return { client, ranges };
}

describe("loadStoreCodeList", () => {
  it("loads more than 1,000 brands and evidence by paging with range", async () => {
    const brandCount = SUPABASE_PAGE_SIZE + 250;
    const evidenceCount = SUPABASE_PAGE_SIZE + 100;
    const { client, ranges } = cappedClient(brandCount, evidenceCount);

    const { items, error } = await loadStoreCodeList(client);

    expect(error).toBeNull();
    expect(items).toHaveLength(brandCount);
    expect(items[0]?.name).toBe("Chain 0000");
    expect(items.at(-1)?.name).toBe(`Chain ${String(brandCount - 1).padStart(4, "0")}`);

    expect(ranges.merchant_brands).toEqual([
      { from: 0, to: SUPABASE_PAGE_SIZE - 1 },
      { from: SUPABASE_PAGE_SIZE, to: SUPABASE_PAGE_SIZE * 2 - 1 },
    ]);
    expect(ranges.merchant_code_evidence).toEqual([
      { from: 0, to: SUPABASE_PAGE_SIZE - 1 },
      { from: SUPABASE_PAGE_SIZE, to: SUPABASE_PAGE_SIZE * 2 - 1 },
    ]);

    // Evidence attached past the first page still affects Needs evidence.
    const withEvidence = items.filter((i) => i.evidence_count > 0);
    expect(withEvidence.length).toBeGreaterThan(0);
    expect(items.some((i) => i.needs_evidence)).toBe(true);
  });
});
