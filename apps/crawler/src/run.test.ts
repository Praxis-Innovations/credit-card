import { describe, expect, it, vi } from "vitest";
import type { Extractor } from "./extract/claude";
import type { FetchResult } from "./fetcher";
import { nullOutput } from "./output";
import { MissingClaudeCredentialsError, runCrawl, type RunDeps } from "./run";
import { LocalCache, ReadOnlyStore, type DiscoveredUpsert, type FindingRow, type RunPatch, type Store } from "./store";
import { CATALOG, GOLD_PAGE_TEXT, goldExtraction } from "./test/fixtures";
import type { CrawlSource } from "./types";

const COMPARE = "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html";
const GOLD = "https://www.scotiabank.com/ca/en/personal/credit-cards/american-express/gold-card.html";
const SCENE = "https://www.scotiabank.com/ca/en/personal/credit-cards/visa/scene-card.html";

const SOURCE: CrawlSource = {
  id: "src-1",
  issuer_name: "Scotiabank",
  compare_url: COMPARE,
  url_pattern: "/credit-cards/",
  status: "active",
};

const compareHtml = (extra = "") => `<html><body><main>
  <h1>Compare cards</h1>
  <a href="${GOLD}">Scotiabank Gold American Express Card</a>
  <a href="${SCENE}">Scotiabank Scene+ Visa Card</a>
  <a href="/ca/en/personal/credit-cards/travel.html">Travel cards</a>
  ${extra}
</main></body></html>`;

const goldHtml = `<html><body><main>${GOLD_PAGE_TEXT.split("\n\n").map((p) => `<p>${p}</p>`).join("")}</main></body></html>`;

function memoryStore(source: CrawlSource | null = SOURCE) {
  const runs = new Map<string, RunPatch & { created?: boolean }>();
  const findings: FindingRow[] = [];
  const discovered: Array<{ product_url: string }> = [];
  const store: Store = {
    mode: "database",
    getSource: vi.fn(async () => source),
    getCatalog: vi.fn(async () => CATALOG),
    getDiscovered: vi.fn(async () => []),
    previousDiscovery: vi.fn(async () => null),
    previousCard: vi.fn(async () => null),
    createRun: vi.fn(async (r) => void runs.set(r.id, { status: "running", created: true })),
    updateRun: vi.fn(async (id, patch) => void runs.set(id, { ...runs.get(id), ...patch })),
    upsertDiscovered: vi.fn(async (_sid: string | null, links: DiscoveredUpsert[]) => {
      discovered.push(...links);
      return links.map((l, i) => ({ id: `d${i}`, card_name: l.card_name, product_url: l.product_url, included: true, linked_card_id: null }));
    }),
    insertFindings: vi.fn(async (rows) => void findings.push(...rows)),
    markSourceCrawled: vi.fn(async () => {}),
  };
  return { store, runs, findings, discovered };
}

function fetcherFor(pages: Record<string, string | Omit<Extract<FetchResult, { ok: false }>, "url" | "attempts">>) {
  return {
    fetch: vi.fn(async (url: string): Promise<FetchResult> => {
      const p = pages[url];
      if (p === undefined) throw new Error(`unexpected fetch ${url}`);
      if (typeof p !== "string") return { ...p, url, attempts: 1 };
      return { ok: true, url, finalUrl: url, status: 200, html: p, attempts: 1 };
    }),
  };
}

function mockExtractor(): Extractor & { discoverCardLinks: ReturnType<typeof vi.fn>; extractCard: ReturnType<typeof vi.fn> } {
  return {
    model: "claude-sonnet-5-5",
    discoverCardLinks: vi.fn(async () => ({
      cards: [
        { card_name: "Gold Amex", url: GOLD },
        { card_name: "Scene+ Visa", url: SCENE },
        { card_name: "Made up", url: "https://www.scotiabank.com/ca/en/personal/credit-cards/visa/fake.html" },
      ],
      usage: { inputTokens: 10_000, outputTokens: 500 },
    })),
    extractCard: vi.fn(async ({ pageUrl }: { pageUrl: string }) => {
      if (pageUrl === SCENE) throw new Error("Claude did not call record_card");
      return { extraction: goldExtraction(), usage: { inputTokens: 20_000, outputTokens: 1_000 } };
    }),
  };
}

function deps(over: Partial<RunDeps> = {}): RunDeps {
  return {
    store: memoryStore().store,
    fetcher: fetcherFor({ [COMPARE]: compareHtml(), [GOLD]: goldHtml, [SCENE]: goldHtml }),
    extractor: mockExtractor(),
    cache: new LocalCache(null),
    output: () => nullOutput,
    ...over,
  };
}

describe("runCrawl", () => {
  it("fails fast with a clear message when there is no Claude extractor", async () => {
    await expect(runCrawl({ source: "scotiabank", dryRun: true }, deps({ extractor: null }))).rejects.toThrow(MissingClaudeCredentialsError);
    await expect(runCrawl({ source: "scotiabank", dryRun: true }, deps({ extractor: null }))).rejects.toThrow(/Workload Identity Federation.*--no-llm/);
  });

  it("refuses unknown and inactive sources", async () => {
    await expect(runCrawl({ source: "nope", dryRun: true }, deps({ store: memoryStore(null).store }))).rejects.toThrow(/No crawl source/);
    const paused = memoryStore({ ...SOURCE, status: "paused" }).store;
    await expect(runCrawl({ source: "scotiabank", dryRun: true }, deps({ store: paused }))).rejects.toThrow(/paused/);
  });

  it("reuses an admin-requested run id when runId is passed", async () => {
    const mem = memoryStore();
    const summary = await runCrawl(
      { source: "scotiabank", dryRun: false, runId: "admin-requested-id", trigger: "manual" },
      deps({ store: mem.store }),
    );
    expect(summary.run_id).toBe("admin-requested-id");
    // createRun receives the existing id; SupabaseStore claims requested → running.
    expect(mem.store.createRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-requested-id", trigger: "manual" }),
    );
  });

  it("discovers, extracts, checks, diffs and records a full run", async () => {
    const mem = memoryStore();
    const extractor = mockExtractor();
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ store: mem.store, extractor }));

    expect(summary.status).toBe("done");
    expect(summary.discovered.map((d) => d.url)).toEqual([GOLD, SCENE]);
    expect(summary.counts).toMatchObject({
      cards_discovered: 2,
      pages_fetched: 3,
      claude_calls: 2,
      cards_extracted: 1,
      pages_skipped: 1,
      findings_changed: 1,
      findings_possibly_discontinued: 1,
    });
    expect(summary.skipped).toEqual([{ url: SCENE, reason: "extraction_failed", detail: "Claude did not call record_card" }]);
    // 30k in / 1.5k out at $2 / $10 per MTok
    expect(summary.cost_estimate_usd).toBeCloseTo(0.075, 6);

    const [gold, gone] = mem.findings;
    expect(gold).toMatchObject({
      run_id: summary.run_id,
      source_id: "src-1",
      discovered_url_id: "d0",
      product_url: GOLD,
      diff_kind: "changed",
      linked_card_id: "scotia-gold-amex",
      flagged_count: 0,
      reused_extraction: false,
      input_tokens: 20_000,
      review_status: "pending",
      checked_at: expect.any(String),
    });
    expect(gone).toMatchObject({
      diff_kind: "possibly_discontinued",
      linked_card_id: "scotia-scene-visa",
      product_url: null,
      review_status: "pending",
    });
    expect((gone!.diff as { note: string }).note).toMatch(/could not be fetched or extracted/);
    expect(mem.runs.get(summary.run_id)).toMatchObject({ status: "done", compare_page_hash: expect.stringMatching(/^sha256:/) });
    expect(mem.store.markSourceCrawled).toHaveBeenCalledWith("src-1", expect.any(String));
  });

  it("stores a card with no changes as checked, with the check time, and keeps new cards pending", async () => {
    const mem = memoryStore();
    const gold = CATALOG[0]!;
    vi.mocked(mem.store.getCatalog).mockResolvedValue([
      {
        ...gold,
        reward_categories: gold.reward_categories.map((r) => (r.category === "groceries" ? { ...r, earnRate: 6 } : r)),
        welcome_offer: { summary: "50,000 Scene+ points in the first year", estimatedValueCad: 500 },
      },
    ]);
    const extractor = mockExtractor();
    extractor.extractCard.mockImplementation(async ({ pageUrl }: { pageUrl: string }) => ({
      extraction:
        pageUrl === SCENE
          ? goldExtraction({ card_name: { value: "Scotiabank Platinum Amex Card", quote: "Scotiabank Gold American Express® Card" } })
          : goldExtraction(),
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const at = new Date("2026-10-14T12:00:00.000Z");
    const summary = await runCrawl(
      { source: "scotiabank", dryRun: false },
      deps({ store: mem.store, extractor, now: () => at }),
    );

    expect(summary.counts).toMatchObject({ findings_unchanged: 1, findings_new: 1, findings_possibly_discontinued: 0 });
    const byUrl = new Map(mem.findings.map((f) => [f.product_url, f]));
    expect(byUrl.get(GOLD)).toMatchObject({
      diff_kind: "unchanged",
      review_status: "checked",
      checked_at: at.toISOString(),
      linked_card_id: "scotia-gold-amex",
    });
    expect(byUrl.get(SCENE)).toMatchObject({ diff_kind: "new", review_status: "pending", checked_at: at.toISOString() });
    expect(mem.findings.filter((f) => f.review_status === "pending").map((f) => f.diff_kind)).toEqual(["new"]);
  });

  it("skips Claude for pages whose content hash is unchanged", async () => {
    const cache = new LocalCache(null);
    const first = mockExtractor();
    await runCrawl({ source: "scotiabank", dryRun: true }, deps({ cache, extractor: first }));
    expect(first.discoverCardLinks).toHaveBeenCalledTimes(1);
    expect(first.extractCard).toHaveBeenCalledTimes(2);

    const second = mockExtractor();
    const mem = memoryStore();
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ cache, extractor: second, store: mem.store }));
    expect(second.discoverCardLinks).not.toHaveBeenCalled();
    // Gold is reused; Scene failed last time so it is extracted again.
    expect(second.extractCard).toHaveBeenCalledTimes(1);
    expect(summary.counts.hash_skips).toBe(2);
    expect(mem.findings[0]).toMatchObject({ product_url: GOLD, reused_extraction: true, model: null, cost_estimate_usd: 0 });
  });

  it("re-extracts when the page content changes", async () => {
    const cache = new LocalCache(null);
    await runCrawl({ source: "scotiabank", dryRun: true }, deps({ cache }));
    const extractor = mockExtractor();
    const fetcher = fetcherFor({ [COMPARE]: compareHtml("<p>New promo</p>"), [GOLD]: goldHtml.replace("$120", "$150"), [SCENE]: goldHtml });
    await runCrawl({ source: "scotiabank", dryRun: true }, deps({ cache, extractor, fetcher }));
    expect(extractor.discoverCardLinks).toHaveBeenCalledTimes(1);
    expect(extractor.extractCard).toHaveBeenCalledTimes(2);
  });

  it("re-extracts when the model differs even if the page hash matches", async () => {
    const cache = new LocalCache(null);
    await runCrawl({ source: "scotiabank", dryRun: true }, deps({ cache }));
    const haiku = { ...mockExtractor(), model: "claude-haiku-5-5" };
    const mem = memoryStore();
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ cache, extractor: haiku, store: mem.store }));
    expect(haiku.extractCard).toHaveBeenCalled();
    expect(summary.counts.hash_skips).toBe(1); // compare-page discovery only
    expect(mem.findings.some((f) => f.model === "claude-haiku-5-5")).toBe(true);
  });

  it("uses database history for the hash skip", async () => {
    const mem = memoryStore();
    const { cleanPage } = await import("./clean");
    const { contentHash } = await import("./hash");
    vi.mocked(mem.store.previousCard).mockImplementation(async (_s, url) =>
      url === GOLD
        ? { hash: contentHash(cleanPage(goldHtml, GOLD).text), extraction: goldExtraction(), model: "claude-sonnet-5-5" }
        : null,
    );
    const extractor = mockExtractor();
    await runCrawl({ source: "scotiabank", dryRun: false }, deps({ store: mem.store, extractor }));
    expect(extractor.extractCard).toHaveBeenCalledTimes(1);
    expect(extractor.extractCard).toHaveBeenCalledWith(expect.objectContaining({ pageUrl: SCENE }));
  });

  it("re-extracts when the page hash matches but the stored extraction predates the MC2 schema", async () => {
    const mem = memoryStore();
    const { cleanPage } = await import("./clean");
    const { contentHash } = await import("./hash");
    // Pre-MC2 findings omit `promotions` entirely (not an empty array).
    const preMc2 = { ...goldExtraction() } as unknown as Record<string, unknown>;
    delete preMc2.promotions;
    vi.mocked(mem.store.previousCard).mockImplementation(async (_s, url) =>
      url === GOLD
        ? {
            hash: contentHash(cleanPage(goldHtml, GOLD).text),
            extraction: preMc2 as unknown as ReturnType<typeof goldExtraction>,
            model: "claude-sonnet-5-5",
          }
        : null,
    );
    const extractor = mockExtractor();
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ store: mem.store, extractor }));
    expect(extractor.extractCard).toHaveBeenCalledWith(expect.objectContaining({ pageUrl: GOLD }));
    expect(extractor.extractCard).toHaveBeenCalledWith(expect.objectContaining({ pageUrl: SCENE }));
    expect(summary.counts.hash_skips).toBe(0);
    expect(mem.findings.find((f) => f.product_url === GOLD)).toMatchObject({
      reused_extraction: false,
      extracted: expect.objectContaining({ promotions: expect.any(Array) }),
    });
  });

  it("writes nothing to the database on a dry run", async () => {
    const mem = memoryStore();
    const summary = await runCrawl({ source: "scotiabank", dryRun: true }, deps({ store: new ReadOnlyStore(mem.store) }));
    expect(summary.mode).toBe("dry-run");
    expect(summary.counts.findings_changed).toBe(1);
    for (const write of ["createRun", "updateRun", "upsertDiscovered", "insertFindings", "markSourceCrawled"] as const) {
      expect(mem.store[write]).not.toHaveBeenCalled();
    }
  });

  it("honours --limit and then does not guess at discontinued cards", async () => {
    const summary = await runCrawl({ source: "scotiabank", dryRun: true, limit: 1 }, deps());
    expect(summary.counts).toMatchObject({ cards_discovered: 2, pages_fetched: 2, findings_possibly_discontinued: 0 });
  });

  it("logs and skips blocked card pages without failing the run", async () => {
    const fetcher = fetcherFor({
      [COMPARE]: compareHtml(),
      [GOLD]: goldHtml,
      [SCENE]: { ok: false, reason: "blocked", detail: "HTTP 403", status: 403 },
    });
    const mem = memoryStore();
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ fetcher, store: mem.store }));
    expect(summary.status).toBe("done");
    expect(summary.skipped).toEqual([{ url: SCENE, reason: "blocked", detail: "HTTP 403" }]);
    expect(mem.discovered).toContainEqual({ card_name: "Scene+ Visa", product_url: SCENE, http_status: 403, fetched: true });
  });

  it("marks the run failed when the compare page is disallowed", async () => {
    const mem = memoryStore();
    const fetcher = fetcherFor({ [COMPARE]: { ok: false, reason: "robots_disallowed", detail: "robots.txt disallows /ca/" } });
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ fetcher, store: mem.store }));
    expect(summary.status).toBe("failed");
    expect(summary.error).toMatch(/robots_disallowed/);
    expect(mem.runs.get(summary.run_id)).toMatchObject({ status: "failed", error: expect.stringMatching(/robots/) });
    expect(mem.store.insertFindings).not.toHaveBeenCalled();
  });

  it("--no-llm picks links heuristically and never needs an extractor", async () => {
    const summary = await runCrawl({ source: "scotiabank", dryRun: true, noLlm: true }, deps({ extractor: null }));
    expect(summary.discovered.map((d) => d.url)).toEqual([GOLD, SCENE]);
    expect(summary.counts).toMatchObject({ pages_fetched: 3, claude_calls: 0, cards_extracted: 0 });
    expect(summary.findings).toEqual([]);
  });

  it("drops card pages an admin excluded", async () => {
    const mem = memoryStore();
    vi.mocked(mem.store.getDiscovered).mockResolvedValue([
      { id: "x", card_name: "Scene+ Visa", product_url: SCENE, included: false, linked_card_id: null },
    ]);
    const summary = await runCrawl({ source: "scotiabank", dryRun: false }, deps({ store: mem.store }));
    expect(summary.discovered.map((d) => d.url)).toEqual([GOLD]);
  });
});

describe("ReadOnlyStore", () => {
  it("falls back when a table is missing and warns once", async () => {
    const mem = memoryStore();
    vi.mocked(mem.store.previousCard).mockRejectedValue(new Error("Could not find the table 'public.card_findings'"));
    const log = vi.fn();
    const store = new ReadOnlyStore(mem.store, log);
    expect(await store.previousCard("src-1", GOLD)).toBeNull();
    expect(await store.previousCard("src-1", SCENE)).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/previous findings unavailable/);
  });
});
