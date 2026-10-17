import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SUPABASE_PAGE_SIZE } from "@/lib/supabase/fetch-all";
import { loadCatalogCards } from "./load";

type Page = { from: number; to: number };

/**
 * Fake PostgREST client that enforces the 1,000-row cap via `.range()` and
 * returns the requested cards / pending / sources slices.
 */
function cappedClient(cardCount: number, pendingCount: number, sourceCount: number) {
  const ranges: Record<string, Page[]> = {
    cards: [],
    card_findings: [],
    crawl_sources: [],
  };

  function tableData(table: string, from: number, to: number) {
    if (table === "cards") {
      const end = Math.min(to + 1, cardCount);
      return Array.from({ length: Math.max(0, end - from) }, (_, i) => {
        const n = from + i;
        return {
          id: `card-${n}`,
          name: `Card ${String(n).padStart(4, "0")}`,
          issuer: n % 2 === 0 ? "Scotiabank" : "Other Bank",
          annual_fee: 0,
          point_currency: "cashback",
          reward_categories: [{ category: "other", earnRate: 1 }],
          welcome_offer: null,
          network: null,
          tier: null,
          last_verified: "2026-10-15",
          captured_at: "2026-10-15T00:00:00Z",
          verified_at: "2026-10-15T00:00:00Z",
          status: "verified",
          image_url: null,
          image_alt: null,
          image_source_url: null,
          image_rights_status: "unknown",
          reviewed_by: null,
        };
      });
    }
    if (table === "card_findings") {
      const end = Math.min(to + 1, pendingCount);
      return Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
        linked_card_id: `card-${from + i}`,
      }));
    }
    if (table === "crawl_sources") {
      const end = Math.min(to + 1, sourceCount);
      return Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
        issuer_name: from + i === 0 ? "Scotiabank" : `Issuer ${from + i}`,
      }));
    }
    return [];
  }

  function builder(table: string) {
    let from = 0;
    let to = SUPABASE_PAGE_SIZE - 1;
    const api: Record<string, unknown> = {};
    const chain = () => api;
    for (const method of ["select", "eq", "not", "order"]) {
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
      return { data: data.slice(0, SUPABASE_PAGE_SIZE), error: null };
    };
    return api;
  }

  const client = {
    from: (table: string) => builder(table),
  } as unknown as SupabaseClient;

  return { client, ranges };
}

describe("loadCatalogCards", () => {
  it("loads more than 1,000 cards by paging with range", async () => {
    const cardCount = SUPABASE_PAGE_SIZE + 250;
    const { client, ranges } = cappedClient(cardCount, 3, 1);

    const { cards, error } = await loadCatalogCards(client);

    expect(error).toBeNull();
    expect(cards).toHaveLength(cardCount);
    expect(cards[0]?.name).toBe("Card 0000");
    expect(cards.at(-1)?.name).toBe(`Card ${String(cardCount - 1).padStart(4, "0")}`);
    expect(cards[0]?.pending_change).toBe(true);
    expect(cards[0]?.has_crawl_source).toBe(true);
    expect(cards[1]?.has_crawl_source).toBe(false);

    expect(ranges.cards).toEqual([
      { from: 0, to: SUPABASE_PAGE_SIZE - 1 },
      { from: SUPABASE_PAGE_SIZE, to: SUPABASE_PAGE_SIZE * 2 - 1 },
    ]);
  });
});
