import { randomUUID } from "node:crypto";
import { checkExtraction } from "./checks";
import { cleanPage } from "./clean";
import { estimateCostUsd } from "./config";
import { diffCard, findPossiblyDiscontinued, type DiffResult } from "./diff";
import type { Extractor } from "./extract/claude";
import type { CardExtraction } from "./extract/schema";
import type { FetchResult } from "./fetcher";
import { contentHash } from "./hash";
import { acceptDiscoveredLinks, heuristicCardLinks } from "./links";
import { slugForUrl, type OutputWriter } from "./output";
import type { DiscoveredRow, FindingRow, LocalCache, RunCounts, Store } from "./store";
import type { CardFinding, CardLink, SkippedPage, Usage } from "./types";

export type Trigger = "cli" | "manual" | "schedule";

export interface RunOptions {
  /** Issuer name as in crawl_sources.issuer_name (case-insensitive). */
  source: string;
  dryRun: boolean;
  /** Skip Claude: heuristic link pick, fetch + clean pages only. */
  noLlm?: boolean;
  /** Max card pages to fetch. Disables the "possibly discontinued" check. */
  limit?: number;
  trigger?: Trigger;
  /** Reuse an existing crawl_runs row (e.g. one an admin requested). */
  runId?: string;
}

export interface RunDeps {
  store: Store;
  fetcher: { fetch(url: string): Promise<FetchResult> };
  /** Required unless noLlm. */
  extractor: Extractor | null;
  cache: LocalCache;
  output: (runId: string) => OutputWriter;
  log?: (msg: string) => void;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

export interface RunSummary {
  run_id: string;
  source: string;
  compare_url: string;
  mode: "database" | "dry-run" | "dry-run (offline)";
  model: string | null;
  no_llm: boolean;
  limit: number | null;
  started_at: string;
  finished_at: string;
  status: "done" | "failed";
  error: string | null;
  counts: RunCounts;
  usage: Usage;
  cost_estimate_usd: number;
  cost_per_extracted_card_usd: number | null;
  discovered: CardLink[];
  skipped: SkippedPage[];
  findings: Array<{
    card_name: string | null;
    product_url: string | null;
    diff_kind: string | null;
    linked_card_id: string | null;
    flagged: number;
    reused: boolean;
    changes: DiffResult["changes"];
  }>;
  output_dir: string | null;
}

function emptyCounts(): RunCounts {
  return {
    links_on_compare_page: 0,
    cards_discovered: 0,
    pages_fetched: 0,
    pages_skipped: 0,
    claude_calls: 0,
    hash_skips: 0,
    cards_extracted: 0,
    flagged_values: 0,
    findings_new: 0,
    findings_changed: 0,
    findings_unchanged: 0,
    findings_possibly_discontinued: 0,
  };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to apps/crawler/.env.local to extract card data, " +
        "or pass --no-llm to only fetch the compare page, discover card links and save cleaned page text.",
    );
  }
}

/**
 * One crawl of one source. Everything with side effects comes in through
 * `deps`, so the CLI and a future scheduled workflow share this function.
 */
export async function runCrawl(opts: RunOptions, deps: RunDeps): Promise<RunSummary> {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => new Date());
  const noLlm = !!opts.noLlm;
  if (!noLlm && !deps.extractor) throw new MissingApiKeyError();

  const source = await deps.store.getSource(opts.source);
  if (!source) throw new Error(`No crawl source named "${opts.source}". Add it on the admin Sources page.`);
  if (source.status !== "active") {
    throw new Error(`Source "${source.issuer_name}" is ${source.status}; only active sources are crawled.`);
  }
  if (!source.compare_url) throw new Error(`Source "${source.issuer_name}" has no compare_url.`);

  const runId = opts.runId ?? randomUUID();
  const out = deps.output(runId);
  const model = noLlm ? null : deps.extractor!.model;
  const startedAt = now().toISOString();
  const counts = emptyCounts();
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let cost = 0;
  const skipped: SkippedPage[] = [];
  const findings: CardFinding[] = [];
  let discovered: CardLink[] = [];
  let compareHash: string | null = null;

  const addUsage = (u: Usage) => {
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    const c = estimateCostUsd(model!, u, deps.env);
    cost += c;
    counts.claude_calls++;
    return c;
  };

  await deps.store.createRun({
    id: runId,
    source_id: source.id,
    source_scope: source.issuer_name,
    trigger: opts.trigger ?? "cli",
    model,
    started_at: startedAt,
  });
  log(`run ${runId} — ${source.issuer_name} (${deps.store.mode}${noLlm ? ", no LLM" : `, model ${model}`})`);

  let status: "done" | "failed" = "done";
  let errorMessage: string | null = null;
  try {
    // 1. Compare page -------------------------------------------------------
    log(`fetch compare page ${source.compare_url}`);
    const compare = await deps.fetcher.fetch(source.compare_url);
    if (!compare.ok) {
      skipped.push({ url: compare.url, reason: compare.reason, detail: compare.detail });
      throw new Error(`compare page not fetched (${compare.reason}: ${compare.detail})`);
    }
    counts.pages_fetched++;
    const comparePage = cleanPage(compare.html, compare.finalUrl);
    compareHash = contentHash(comparePage.text);
    counts.links_on_compare_page = comparePage.links.length;
    await out.text("compare/page.txt", comparePage.text);
    await out.json("compare/links.json", comparePage.links);

    // 2. Card links ---------------------------------------------------------
    if (noLlm) {
      discovered = heuristicCardLinks(comparePage.links, source.url_pattern);
      log(`heuristic link pick (no LLM): ${discovered.length} card pages`);
    } else {
      const prev = (await deps.store.previousDiscovery(source.id)) ?? deps.cache.getCompare(source.compare_url);
      if (prev && prev.hash === compareHash) {
        discovered = prev.links;
        counts.hash_skips++;
        log(`compare page unchanged since last run; reusing ${discovered.length} card links`);
      } else {
        const res = await deps.extractor!.discoverCardLinks({
          issuer: source.issuer_name,
          pageUrl: compare.finalUrl,
          pageText: comparePage.text,
          links: comparePage.links,
        });
        addUsage(res.usage);
        const { accepted, rejected } = acceptDiscoveredLinks(res.cards, comparePage.links, source.url_pattern);
        discovered = accepted;
        if (rejected.length) await out.json("compare/rejected-links.json", rejected);
        log(`Claude picked ${res.cards.length} links; kept ${accepted.length}, rejected ${rejected.length}`);
      }
      deps.cache.setCompare(source.compare_url, { hash: compareHash, links: discovered });
    }

    const known = await deps.store.getDiscovered(source.id);
    const knownByUrl = new Map<string, DiscoveredRow>(known.map((r) => [r.product_url, r]));
    const excluded = discovered.filter((l) => knownByUrl.get(l.url)?.included === false);
    if (excluded.length) log(`skipping ${excluded.length} card page(s) an admin excluded`);
    discovered = discovered.filter((l) => knownByUrl.get(l.url)?.included !== false);
    counts.cards_discovered = discovered.length;
    await out.json("compare/card-links.json", discovered);

    const toFetch = opts.limit && opts.limit > 0 ? discovered.slice(0, opts.limit) : discovered;
    const limited = toFetch.length < discovered.length;
    const catalog = noLlm ? null : await deps.store.getCatalog(source.issuer_name);
    if (!noLlm && !catalog) log("catalog unavailable — diff against cards is skipped");

    // 3. Card pages ---------------------------------------------------------
    const fetchStatus = new Map<string, number | null>();
    for (const [i, link] of toFetch.entries()) {
      const slug = `${String(i + 1).padStart(2, "0")}-${slugForUrl(link.url)}`;
      log(`[${i + 1}/${toFetch.length}] ${link.card_name} — ${link.url}`);
      const page = await deps.fetcher.fetch(link.url);
      if (!page.ok) {
        skipped.push({ url: link.url, reason: page.reason, detail: page.detail });
        fetchStatus.set(link.url, page.status ?? null);
        log(`  skipped: ${page.reason} (${page.detail})`);
        continue;
      }
      counts.pages_fetched++;
      fetchStatus.set(link.url, page.status);
      const cleaned = cleanPage(page.html, page.finalUrl);
      const hash = contentHash(cleaned.text);
      await out.text(`pages/${slug}.txt`, cleaned.text);
      if (noLlm) continue;

      let extraction: CardExtraction;
      let callUsage: Usage | null = null;
      let callCost = 0;
      let reused = false;
      const prev = (await deps.store.previousCard(source.id, link.url)) ?? deps.cache.getCard(link.url);
      if (prev && prev.hash === hash) {
        extraction = prev.extraction;
        reused = true;
        counts.hash_skips++;
        log("  unchanged since last fetch; reusing previous extraction");
      } else {
        try {
          const res = await deps.extractor!.extractCard({
            issuer: source.issuer_name,
            pageUrl: page.finalUrl,
            pageText: cleaned.text,
          });
          extraction = res.extraction;
          callUsage = res.usage;
          callCost = addUsage(res.usage);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          skipped.push({ url: link.url, reason: "extraction_failed", detail });
          log(`  extraction failed: ${detail}`);
          continue;
        }
      }
      deps.cache.setCard(link.url, { hash, extraction });
      counts.cards_extracted++;

      const checks = checkExtraction(extraction, cleaned.text);
      counts.flagged_values += checks.flagged;
      const diff = diffCard(extraction, checks, catalog, source.issuer_name, knownByUrl.get(link.url)?.linked_card_id ?? null);
      const finding: CardFinding = {
        card_name: extraction.card_name?.value ?? link.card_name,
        product_url: link.url,
        page_hash: hash,
        extracted: extraction,
        checks,
        diff,
        reused,
        model: reused ? null : model,
        usage: callUsage,
        cost_usd: callCost,
      };
      findings.push(finding);
      await out.json(`extractions/${slug}.json`, finding);
      log(
        `  ${diff.kind ?? "extracted"}${diff.linked_card_id ? ` (${diff.linked_card_id})` : ""}; ` +
          `${checks.flagged}/${checks.total} values flagged${diff.changes.length ? `; ${diff.changes.length} change(s)` : ""}`,
      );
    }

    // 4. Possibly discontinued ----------------------------------------------
    if (catalog && !noLlm) {
      if (limited) {
        log("--limit set: not checking for discontinued cards");
      } else {
        const matched = new Set(findings.map((f) => f.diff.linked_card_id).filter((id): id is string => !!id));
        const missingPages = skipped.filter((s) => s.url !== source.compare_url).length;
        for (const card of findPossiblyDiscontinued(catalog, matched)) {
          findings.push({
            card_name: card.name,
            product_url: null,
            page_hash: null,
            extracted: null,
            checks: null,
            diff: {
              kind: "possibly_discontinued",
              linked_card_id: card.id,
              match: null,
              changes: [],
              note: missingPages
                ? `In the catalog but not matched; ${missingPages} card page(s) could not be fetched or extracted this run.`
                : "In the catalog but no card page on the compare page matched it.",
            },
            reused: false,
            model: null,
            usage: null,
            cost_usd: 0,
          });
        }
      }
    }

    for (const f of findings) {
      if (f.diff.kind === "new") counts.findings_new++;
      else if (f.diff.kind === "changed") counts.findings_changed++;
      else if (f.diff.kind === "unchanged") counts.findings_unchanged++;
      else if (f.diff.kind === "possibly_discontinued") counts.findings_possibly_discontinued++;
    }
    counts.pages_skipped = skipped.length;

    // 5. Persist -------------------------------------------------------------
    const at = now().toISOString();
    const rows = await deps.store.upsertDiscovered(
      source.id,
      discovered.map((l) => ({
        card_name: l.card_name,
        product_url: l.url,
        http_status: fetchStatus.get(l.url) ?? null,
        fetched: fetchStatus.has(l.url),
      })),
      at,
    );
    const idByUrl = new Map(rows.map((r) => [r.product_url, r.id]));
    if (source.id) {
      const sourceId = source.id;
      await deps.store.insertFindings(
        findings.map(
          (f): FindingRow => ({
            run_id: runId,
            source_id: sourceId,
            discovered_url_id: f.product_url ? (idByUrl.get(f.product_url) ?? knownByUrl.get(f.product_url)?.id ?? null) : null,
            product_url: f.product_url,
            card_name: f.card_name,
            page_hash: f.page_hash,
            extracted: f.extracted,
            check_results: f.checks,
            flagged_count: f.checks?.flagged ?? 0,
            diff_kind: f.diff.kind,
            diff: f.diff,
            linked_card_id: f.diff.linked_card_id,
            reused_extraction: f.reused,
            model: f.model,
            input_tokens: f.usage?.inputTokens ?? 0,
            output_tokens: f.usage?.outputTokens ?? 0,
            cost_estimate_usd: Number(f.cost_usd.toFixed(6)),
          }),
        ),
      );
    }
    await deps.store.markSourceCrawled(source.id, at);
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    counts.pages_skipped = skipped.length;
    log(`run failed: ${errorMessage}`);
  }

  const finishedAt = now().toISOString();
  const roundedCost = Number(cost.toFixed(6));
  try {
    await deps.store.updateRun(runId, {
      status,
      counts,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_estimate_usd: roundedCost,
      compare_page_hash: compareHash,
      discovered_links: noLlm ? undefined : discovered,
      skipped,
      finished_at: finishedAt,
      error: errorMessage,
    });
  } catch (err) {
    log(`could not record run status: ${err instanceof Error ? err.message : err}`);
  }
  if (status === "done" && !noLlm) await deps.cache.save();

  const extractedNow = findings.filter((f) => f.usage).length;
  const summary: RunSummary = {
    run_id: runId,
    source: source.issuer_name,
    compare_url: source.compare_url,
    mode: opts.dryRun ? (deps.store.mode === "offline" ? "dry-run (offline)" : "dry-run") : "database",
    model,
    no_llm: noLlm,
    limit: opts.limit ?? null,
    started_at: startedAt,
    finished_at: finishedAt,
    status,
    error: errorMessage,
    counts,
    usage,
    cost_estimate_usd: roundedCost,
    cost_per_extracted_card_usd: extractedNow ? Number((roundedCost / extractedNow).toFixed(6)) : null,
    discovered,
    skipped,
    findings: findings.map((f) => ({
      card_name: f.card_name,
      product_url: f.product_url,
      diff_kind: f.diff.kind,
      linked_card_id: f.diff.linked_card_id,
      flagged: f.checks?.flagged ?? 0,
      reused: f.reused,
      changes: f.diff.changes,
    })),
    output_dir: out.dir,
  };
  await out.json("summary.json", summary);
  return summary;
}
