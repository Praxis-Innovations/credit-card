import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_SOURCES } from "./config";
import type { CheckResult } from "./checks";
import type { DiffKind, FindingReviewStatus } from "./diff";
import type { CardExtraction } from "./extract/schema";
import type { CardLink, CatalogCard, CrawlSource, SkippedPage } from "./types";

export interface DiscoveredRow {
  id: string;
  card_name: string;
  product_url: string;
  included: boolean;
  linked_card_id: string | null;
}

export interface PreviousDiscovery {
  hash: string;
  links: CardLink[];
}

export interface PreviousCard {
  hash: string;
  extraction: CardExtraction;
}

export type RunStatus = "requested" | "running" | "done" | "failed";

export interface RunCounts {
  links_on_compare_page: number;
  cards_discovered: number;
  pages_fetched: number;
  pages_skipped: number;
  claude_calls: number;
  hash_skips: number;
  cards_extracted: number;
  flagged_values: number;
  findings_new: number;
  findings_changed: number;
  findings_unchanged: number;
  findings_possibly_discontinued: number;
}

export interface RunPatch {
  status: RunStatus;
  counts?: RunCounts;
  input_tokens?: number;
  output_tokens?: number;
  cost_estimate_usd?: number;
  compare_page_hash?: string | null;
  discovered_links?: CardLink[];
  skipped?: SkippedPage[];
  finished_at?: string;
  error?: string | null;
}

export interface FindingRow {
  run_id: string;
  source_id: string;
  discovered_url_id: string | null;
  product_url: string | null;
  card_name: string | null;
  page_hash: string | null;
  extracted: CardExtraction | null;
  check_results: CheckResult | null;
  flagged_count: number;
  diff_kind: DiffKind | null;
  diff: unknown;
  review_status: FindingReviewStatus;
  /** When the finding was diffed against the catalog; null when no catalog was available. */
  checked_at: string | null;
  linked_card_id: string | null;
  reused_extraction: boolean;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_estimate_usd: number;
}

export interface DiscoveredUpsert {
  card_name: string;
  product_url: string;
  http_status: number | null;
  fetched: boolean;
}

/** Admin-queued crawl_runs row waiting for the Actions worker. */
export interface RequestedRun {
  id: string;
  source_id: string | null;
  source_scope: string;
  trigger: string;
}

export interface Store {
  readonly mode: "database" | "read-only" | "offline";
  getSource(issuer: string): Promise<CrawlSource | null>;
  /** Null when no catalog is reachable; the diff is then skipped. */
  getCatalog(issuer: string): Promise<CatalogCard[] | null>;
  getDiscovered(sourceId: string | null): Promise<DiscoveredRow[]>;
  previousDiscovery(sourceId: string | null): Promise<PreviousDiscovery | null>;
  previousCard(sourceId: string | null, productUrl: string): Promise<PreviousCard | null>;
  /**
   * Start a run. If `id` is an existing `requested` row, claims it
   * (`requested` → `running`); otherwise inserts a new `running` row.
   */
  createRun(run: { id: string; source_id: string | null; source_scope: string; trigger: string; model: string | null; started_at: string }): Promise<void>;
  updateRun(id: string, patch: RunPatch): Promise<void>;
  upsertDiscovered(sourceId: string | null, links: DiscoveredUpsert[], at: string): Promise<DiscoveredRow[]>;
  insertFindings(rows: FindingRow[]): Promise<void>;
  markSourceCrawled(sourceId: string | null, at: string): Promise<void>;
}

/** Extra reads the GitHub Actions worker needs; not used by the local CLI. */
export interface ScheduleStore extends Store {
  listRequestedRuns(): Promise<RequestedRun[]>;
  listActiveSourcesBySchedule(schedule: "monthly"): Promise<CrawlSource[]>;
}

const CATALOG_COLUMNS = "id, name, issuer, annual_fee, network, point_currency, reward_categories, welcome_offer";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

/** Talks to Supabase with the server-side key. Lives only in the crawler's own environment. */
export class SupabaseStore implements ScheduleStore {
  readonly mode = "database" as const;
  constructor(private readonly db: SupabaseClient) {}

  static fromEnv(url: string, serviceKey: string): SupabaseStore {
    return new SupabaseStore(
      createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }

  async getSource(issuer: string): Promise<CrawlSource | null> {
    const { data, error } = await this.db
      .from("crawl_sources")
      .select("id, issuer_name, compare_url, url_pattern, status")
      .ilike("issuer_name", issuer.replace(/[%_]/g, "\\$&"))
      .maybeSingle();
    if (error) fail("read crawl_sources", error);
    return data;
  }

  async listRequestedRuns(): Promise<RequestedRun[]> {
    const { data, error } = await this.db
      .from("crawl_runs")
      .select("id, source_id, source_scope, trigger")
      .eq("status", "requested")
      .order("created_at", { ascending: true });
    if (error) fail("list requested crawl_runs", error);
    return data ?? [];
  }

  async listActiveSourcesBySchedule(schedule: "monthly"): Promise<CrawlSource[]> {
    const { data, error } = await this.db
      .from("crawl_sources")
      .select("id, issuer_name, compare_url, url_pattern, status")
      .eq("status", "active")
      .eq("schedule", schedule)
      .order("issuer_name", { ascending: true });
    if (error) fail("list crawl_sources", error);
    return data ?? [];
  }

  async getCatalog(issuer: string): Promise<CatalogCard[]> {
    const { data, error } = await this.db.from("cards").select(CATALOG_COLUMNS).eq("issuer", issuer);
    if (error) fail("read cards", error);
    return (data ?? []) as CatalogCard[];
  }

  async getDiscovered(sourceId: string | null): Promise<DiscoveredRow[]> {
    if (!sourceId) return [];
    const { data, error } = await this.db
      .from("discovered_card_urls")
      .select("id, card_name, product_url, included, linked_card_id")
      .eq("source_id", sourceId);
    if (error) fail("read discovered_card_urls", error);
    return data ?? [];
  }

  async previousDiscovery(sourceId: string | null): Promise<PreviousDiscovery | null> {
    if (!sourceId) return null;
    const { data, error } = await this.db
      .from("crawl_runs")
      .select("compare_page_hash, discovered_links")
      .eq("source_id", sourceId)
      .eq("status", "done")
      .not("compare_page_hash", "is", null)
      .not("discovered_links", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("read crawl_runs", error);
    return data ? { hash: data.compare_page_hash, links: data.discovered_links } : null;
  }

  async previousCard(sourceId: string | null, productUrl: string): Promise<PreviousCard | null> {
    if (!sourceId) return null;
    const { data, error } = await this.db
      .from("card_findings")
      .select("page_hash, extracted")
      .eq("source_id", sourceId)
      .eq("product_url", productUrl)
      .not("extracted", "is", null)
      .not("page_hash", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("read card_findings", error);
    return data ? { hash: data.page_hash, extraction: data.extracted } : null;
  }

  async createRun(run: Parameters<Store["createRun"]>[0]): Promise<void> {
    // Prefer claiming an admin-requested row so the same id is reused.
    const { data: claimed, error: claimError } = await this.db
      .from("crawl_runs")
      .update({ status: "running", started_at: run.started_at, model: run.model })
      .eq("id", run.id)
      .eq("status", "requested")
      .select("id")
      .maybeSingle();
    if (claimError) fail("claim crawl_runs", claimError);
    if (claimed) return;

    const { error } = await this.db.from("crawl_runs").insert({ ...run, status: "running" });
    if (error) fail("insert crawl_runs", error);
  }

  async updateRun(id: string, patch: RunPatch): Promise<void> {
    const { counts, ...rest } = patch;
    const { error } = await this.db.from("crawl_runs").update({ ...rest, ...(counts ?? {}) }).eq("id", id);
    if (error) fail("update crawl_runs", error);
  }

  async upsertDiscovered(sourceId: string | null, links: DiscoveredUpsert[], at: string): Promise<DiscoveredRow[]> {
    if (!sourceId || links.length === 0) return [];
    const rows = links.map((l) => ({
      source_id: sourceId,
      card_name: l.card_name,
      product_url: l.product_url,
      ...(l.fetched ? { last_fetched_at: at, http_status: l.http_status } : {}),
    }));
    // Rows with and without fetch columns must be sent separately: PostgREST
    // fills missing keys with null in a mixed bulk upsert.
    const out: DiscoveredRow[] = [];
    for (const batch of [rows.filter((r) => "last_fetched_at" in r), rows.filter((r) => !("last_fetched_at" in r))]) {
      if (batch.length === 0) continue;
      const { data, error } = await this.db
        .from("discovered_card_urls")
        .upsert(batch, { onConflict: "source_id,product_url" })
        .select("id, card_name, product_url, included, linked_card_id");
      if (error) fail("upsert discovered_card_urls", error);
      out.push(...(data ?? []));
    }
    return out;
  }

  async insertFindings(rows: FindingRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.db.from("card_findings").insert(rows);
    if (error) fail("insert card_findings", error);
  }

  async markSourceCrawled(sourceId: string | null, at: string): Promise<void> {
    if (!sourceId) return;
    const { error } = await this.db.from("crawl_sources").update({ last_crawled_at: at }).eq("id", sourceId);
    if (error) fail("update crawl_sources", error);
  }
}

/**
 * `--dry-run` over a real database: reads go through, writes are dropped.
 * A read that fails (e.g. the crawler migrations are not applied yet) falls
 * back to the offline behaviour for that call, with a log line.
 */
export class ReadOnlyStore implements Store {
  readonly mode = "read-only" as const;
  private readonly offline = new OfflineStore();
  private readonly warned = new Set<string>();
  constructor(
    private readonly inner: Store,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  private async tolerant<T>(what: string, read: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (err) {
      if (!this.warned.has(what)) {
        this.warned.add(what);
        this.log(`dry run: ${what} unavailable (${err instanceof Error ? err.message : err}); continuing without it`);
      }
      return fallback();
    }
  }
  getSource(issuer: string) {
    return this.tolerant("crawl_sources", () => this.inner.getSource(issuer), () => this.offline.getSource(issuer));
  }
  getCatalog(issuer: string) {
    return this.tolerant("cards catalog", () => this.inner.getCatalog(issuer), () => this.offline.getCatalog());
  }
  getDiscovered(sourceId: string | null) {
    return this.tolerant("discovered_card_urls", () => this.inner.getDiscovered(sourceId), () => this.offline.getDiscovered());
  }
  previousDiscovery(sourceId: string | null) {
    return this.tolerant("previous runs", () => this.inner.previousDiscovery(sourceId), () => this.offline.previousDiscovery());
  }
  previousCard(sourceId: string | null, url: string) {
    return this.tolerant("previous findings", () => this.inner.previousCard(sourceId, url), () => this.offline.previousCard());
  }
  async createRun() {}
  async updateRun() {}
  async upsertDiscovered() {
    return [];
  }
  async insertFindings() {}
  async markSourceCrawled() {}
}

/** `--dry-run` with no database configured: built-in sources, no catalog, no writes. */
export class OfflineStore implements Store {
  readonly mode = "offline" as const;
  async getSource(issuer: string): Promise<CrawlSource | null> {
    const hit = FALLBACK_SOURCES.find((s) => s.issuer_name.toLowerCase() === issuer.toLowerCase());
    return hit ? { ...hit } : null;
  }
  async getCatalog() {
    return null;
  }
  async getDiscovered() {
    return [];
  }
  async previousDiscovery() {
    return null;
  }
  async previousCard() {
    return null;
  }
  async createRun() {}
  async updateRun() {}
  async upsertDiscovered() {
    return [];
  }
  async insertFindings() {}
  async markSourceCrawled() {}
}

interface CacheFile {
  compare: Record<string, PreviousDiscovery>;
  cards: Record<string, PreviousCard>;
}

/**
 * Local page-hash cache in output/cache.json so repeated local (and dry) runs
 * skip Claude for unchanged pages even without database history.
 */
export class LocalCache {
  private data: CacheFile = { compare: {}, cards: {} };

  constructor(private readonly file: string | null) {}

  async load(): Promise<this> {
    if (!this.file) return this;
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<CacheFile>;
      this.data = { compare: parsed.compare ?? {}, cards: parsed.cards ?? {} };
    } catch {
      // Missing or unreadable cache just means no skips this run.
    }
    return this;
  }

  getCompare(url: string): PreviousDiscovery | null {
    return this.data.compare[url] ?? null;
  }
  setCompare(url: string, value: PreviousDiscovery): void {
    this.data.compare[url] = value;
  }
  getCard(url: string): PreviousCard | null {
    return this.data.cards[url] ?? null;
  }
  setCard(url: string, value: PreviousCard): void {
    this.data.cards[url] = value;
  }

  async save(): Promise<void> {
    if (!this.file) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}
