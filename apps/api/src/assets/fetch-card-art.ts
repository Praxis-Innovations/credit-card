/**
 * Card art for dev / test: fetch each card's art from the issuer's own public
 * product page, and generate a neutral render for every card as a fallback.
 *
 *   pnpm --filter api assets:fetch-card-art [--only id,id] [--dry-run] [--no-fetch]
 *
 * Owner decision 2026-09-27 (docs/data/ASSETS.md): issuer-page art is stored
 * with rights 'unknown' and is only served when NORTHTAP_SERVE_UNLICENSED_ASSETS
 * =true. Licensed / issuer_provided rows are never touched.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditCard } from "@/domain";
import { politeFetch, type PoliteFetchResult } from "../data-pipeline/fetch";
import { createServiceClient } from "../data-pipeline/supabase";
import { ASSET_BUCKET, objectPathFor, storagePathFromPublicUrl } from "./assets";
import { fallbackAlt, renderFallbackSvg } from "./card-art/fallback";
import { normalizeCardArt, rasterizeSvg } from "./card-art/image";
import { ISSUER_HOSTS, PRODUCT_PAGES } from "./card-art/product-pages";
import { hostAllowed, rankCandidates, type ScoredCandidate } from "./card-art/select";
import { publicUrlFor, removeObject, uploadObject } from "./storage";

const API_ROOT = path.resolve(__dirname, "../..");
const CACHE_DIR = path.join(API_ROOT, ".cache/card-art");
const REPORT_DIR = path.join(__dirname, "card-art/reports");
/** Candidates downloaded per card before giving up. */
const MAX_TRIES = 10;
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;

type CardRow = Pick<CreditCard, "id" | "issuer" | "name" | "network"> & {
  image_url: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  image_rights_status: string;
  image_fallback_url: string | null;
};

export interface Attempt {
  url: string;
  score: number;
  result: string;
}

export type ArtOutcome = "fetched" | "generated" | "kept" | "skipped";

export interface CardReport {
  id: string;
  issuer: string;
  name: string;
  productUrl: string | null;
  outcome: ArtOutcome;
  /** Issuer image the stored art came from (fetched only). */
  artUrl?: string;
  /** Issuer page that image was found on, stored as image_source_url (fetched only). */
  artPageUrl?: string;
  /** Why the issuer art could not be used (generated / kept). */
  failure?: string;
  changed: boolean;
  imageUrl: string | null;
  fallbackUrl: string | null;
  attempts: Attempt[];
}

interface CacheEntry {
  artUrl: string;
  etag: string | null;
  lastModified: string | null;
  sha256: string;
}

function describeFailure(res: Exclude<PoliteFetchResult, { outcome: "ok" }>): string {
  if (res.outcome === "not_modified") return "not_modified 304 (no cached copy)";
  return `${res.outcome}${res.status ? ` ${res.status}` : ""}${res.error ? ` (${res.error})` : ""}`;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function cacheKey(id: string, url: string): string {
  return `${id}-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

async function readCache(key: string): Promise<{ entry: CacheEntry; bytes: Uint8Array } | null> {
  try {
    const entry = JSON.parse(
      await readFile(path.join(CACHE_DIR, `${key}.json`), "utf8"),
    ) as CacheEntry;
    const bytes = new Uint8Array(await readFile(path.join(CACHE_DIR, `${key}.bin`)));
    return sha256(bytes) === entry.sha256 ? { entry, bytes } : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, entry: CacheEntry, bytes: Uint8Array): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${key}.bin`), bytes);
  await writeFile(path.join(CACHE_DIR, `${key}.json`), `${JSON.stringify(entry, null, 2)}\n`);
}

/**
 * Download a candidate image. A cached copy is revalidated with its ETag /
 * Last-Modified; a cached copy without validators is reused as-is.
 */
async function download(id: string, url: string): Promise<{ bytes: Uint8Array } | { error: string }> {
  const key = cacheKey(id, url);
  const cached = await readCache(key);
  if (cached && !cached.entry.etag && !cached.entry.lastModified) {
    return { bytes: cached.bytes };
  }
  const res = await politeFetch(url, {
    accept: "image/png,image/webp,image/jpeg;q=0.9,image/*;q=0.5",
    etag: cached?.entry.etag,
    lastModified: cached?.entry.lastModified,
    maxBytes: MAX_DOWNLOAD_BYTES,
  });
  if (res.outcome === "not_modified" && cached) return { bytes: cached.bytes };
  if (res.outcome !== "ok") {
    return { error: describeFailure(res) };
  }
  await writeCache(
    key,
    { artUrl: url, etag: res.etag, lastModified: res.lastModified, sha256: sha256(res.body) },
    res.body,
  );
  return { bytes: res.body };
}

type ArtResult =
  | { ok: true; bytes: Uint8Array; artUrl: string; pageUrl: string; attempts: Attempt[] }
  | { ok: false; reason: string; attempts: Attempt[] };

type PageResult = { ok: true; html: string; url: string } | { ok: false; reason: string };

/** Product pages fetched this run; each issuer page is requested at most once. */
const pages = new Map<string, Promise<PageResult>>();

function fetchPage(url: string, allowedHosts: string[]): Promise<PageResult> {
  let p = pages.get(url);
  if (!p) {
    p = (async (): Promise<PageResult> => {
      if (!hostAllowed(url, allowedHosts)) return { ok: false, reason: "product URL is not on an issuer domain" };
      const res = await politeFetch(url, { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" });
      if (res.outcome !== "ok") return { ok: false, reason: `product page ${describeFailure(res)}` };
      if (!hostAllowed(res.finalUrl, allowedHosts)) {
        return { ok: false, reason: `product page redirected off the issuer domain to ${res.finalUrl}` };
      }
      return { ok: true, html: new TextDecoder().decode(res.body), url: res.finalUrl };
    })();
    pages.set(url, p);
  }
  return p;
}

type Candidate = ScoredCandidate & { pageUrl: string };

/**
 * Candidates from the card's own page, plus images on the issuer's other
 * product pages whose alt text names this card (issuers often show related
 * cards in a carousel but leave the card's own art out of its page's HTML).
 */
async function gatherCandidates(
  card: CardRow,
  siblings: CardRow[],
): Promise<{ ranked: Candidate[]; reason?: string }> {
  const page = PRODUCT_PAGES[card.id];
  const allowedHosts = ISSUER_HOSTS[card.issuer] ?? [];
  const ctx = { card, siblingNames: siblings.map((s) => s.name), allowedHosts, hint: page?.hint };
  const ranked: Candidate[] = [];
  let reason: string | undefined;

  if (page) {
    const own = await fetchPage(page.url, allowedHosts);
    if (own.ok) {
      const r = rankCandidates(own.html, own.url, ctx);
      ranked.push(...r.ranked.map((c) => ({ ...c, pageUrl: own.url })));
      if (r.ranked.length === 0) {
        const offHost = r.rejected.find((c) => c.rejected === "host is not an issuer domain" && /card/i.test(c.url));
        reason = offHost
          ? `card art is only on a non-issuer host (${new URL(offHost.url).hostname})`
          : "no card-art candidate in the page HTML";
      }
    } else {
      reason = own.reason;
    }
    if (page.artUrl && hostAllowed(page.artUrl, allowedHosts) && !ranked.some((c) => c.url === page.artUrl)) {
      ranked.unshift({
        url: page.artUrl,
        origin: "img",
        score: REVIEWED_SCORE,
        reasons: ["reviewed artUrl"],
        evidence: "strong",
        pageUrl: page.url,
      });
    }
  } else {
    reason = "no official product page mapped";
  }

  for (const s of siblings) {
    const sp = PRODUCT_PAGES[s.id];
    if (!sp || sp.url === page?.url) continue;
    const other = await fetchPage(sp.url, allowedHosts);
    if (!other.ok) continue;
    for (const c of rankCandidates(other.html, other.url, ctx).ranked) {
      if (c.reasons.some((r) => r.endsWith("alt names this card")) && !ranked.some((x) => x.url === c.url)) {
        ranked.push({ ...c, pageUrl: other.url });
      }
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, reason };
}

async function findArt(card: CardRow, siblings: CardRow[]): Promise<ArtResult> {
  const { ranked, reason } = await gatherCandidates(card, siblings);
  if (ranked.length === 0) {
    return { ok: false, reason: reason ?? "no card-art candidate in the page HTML", attempts: [] };
  }

  // Try the leading candidates and keep the best accepted one, so a small
  // comparison thumbnail doesn't beat the full-size art on the same page.
  const attempts: Attempt[] = [];
  let best: { bytes: Uint8Array; url: string; pageUrl: string; rank: number } | null = null;
  const top = ranked[0]!.score;
  for (const c of ranked.slice(0, MAX_TRIES)) {
    if (c.score < top - SCORE_WINDOW) break;
    const got = await download(card.id, c.url);
    if ("error" in got) {
      attempts.push(attempt(c, got.error));
      continue;
    }
    const norm = await normalizeCardArt(got.bytes);
    if (!norm.ok) {
      attempts.push(attempt(c, `rejected: ${norm.reason}`));
      continue;
    }
    if (c.evidence === "weak" && !norm.cardEdges) {
      attempts.push(attempt(c, "rejected: weak evidence and no card edges (likely a photo)"));
      continue;
    }
    const rank = c.score + sizeBonus(norm.source.width);
    attempts.push(
      attempt(
        c,
        `accepted ${norm.source.width}×${norm.source.height}${norm.source.trimmed ? " (trimmed)" : ""}${norm.source.rotated ? " (rotated)" : ""}`,
      ),
    );
    if (!best || rank > best.rank) best = { bytes: norm.bytes, url: c.url, pageUrl: c.pageUrl, rank };
  }
  if (best) {
    for (const a of attempts) if (a.url === best.url) a.result += " — chosen";
    return { ok: true, bytes: best.bytes, artUrl: best.url, pageUrl: best.pageUrl, attempts };
  }
  return { ok: false, reason: reason ?? "no candidate image was card-shaped", attempts };
}

/** A reviewed artUrl outranks anything picked automatically (like a hint). */
const REVIEWED_SCORE = 100;

/** Candidates scoring this far below the leader aren't worth downloading. */
const SCORE_WINDOW = 30;

/** Up to +30 for resolution (full score at 1200 px wide). */
export function sizeBonus(width: number): number {
  return Math.min(30, Math.floor(width / 40));
}

function attempt(c: ScoredCandidate, result: string): Attempt {
  return { url: c.url, score: c.score, result };
}

/** Plan and apply one card's image columns. Returns the report row. */
async function processCard(
  client: SupabaseClient | null,
  card: CardRow,
  siblings: CardRow[],
  opts: { fetch: boolean; by: string },
): Promise<CardReport> {
  const productUrl = PRODUCT_PAGES[card.id]?.url ?? null;
  const base = { id: card.id, issuer: card.issuer, name: card.name, productUrl };

  if (card.image_rights_status === "licensed" || card.image_rights_status === "issuer_provided") {
    return {
      ...base,
      outcome: "skipped",
      failure: `already ${card.image_rights_status}; never replaced`,
      changed: false,
      imageUrl: card.image_url,
      fallbackUrl: card.image_fallback_url,
      attempts: [],
    };
  }

  const fallbackBytes = await rasterizeSvg(renderFallbackSvg(card));
  const fallbackPath = objectPathFor("card", card.id, "fallback.png", fallbackBytes, "generated");
  const fallbackUrl = client ? publicUrlFor(client, fallbackPath) : `<public url of ${fallbackPath}>`;

  const art = opts.fetch ? await findArt(card, siblings) : null;
  const patch: Record<string, string | null> = {};
  const uploads: Array<{ path: string; bytes: Uint8Array }> = [];
  let outcome: ArtOutcome;
  let artUrl: string | undefined;
  let artPageUrl: string | undefined;
  let imageUrl = card.image_url;

  if (card.image_fallback_url !== fallbackUrl) {
    uploads.push({ path: fallbackPath, bytes: fallbackBytes });
    patch.image_fallback_url = fallbackUrl;
  }

  if (art?.ok) {
    const artPath = objectPathFor("card", card.id, "art.png", art.bytes);
    const url = client ? publicUrlFor(client, artPath) : `<public url of ${artPath}>`;
    const alt = `${card.issuer} ${card.name} card`;
    outcome = "fetched";
    artUrl = art.artUrl;
    artPageUrl = art.pageUrl;
    imageUrl = url;
    if (
      card.image_url !== url ||
      card.image_rights_status !== "unknown" ||
      card.image_alt !== alt ||
      card.image_source_url !== art.pageUrl
    ) {
      if (card.image_url !== url) uploads.push({ path: artPath, bytes: art.bytes });
      Object.assign(patch, {
        image_url: url,
        image_alt: alt,
        image_source_url: art.pageUrl,
        image_rights_status: "unknown",
      });
    }
  } else if (card.image_rights_status === "unknown" && card.image_url && !opts.fetch) {
    outcome = "kept";
  } else if (card.image_rights_status === "unknown" && card.image_url && art && !art.ok && isTransient(art.reason)) {
    // A flaky fetch shouldn't wipe art that was fetched successfully before.
    outcome = "kept";
  } else {
    outcome = "generated";
    imageUrl = fallbackUrl;
    const alt = fallbackAlt(card);
    if (
      card.image_url !== fallbackUrl ||
      card.image_rights_status !== "generated" ||
      card.image_alt !== alt ||
      card.image_source_url !== null
    ) {
      Object.assign(patch, {
        image_url: fallbackUrl,
        image_alt: alt,
        image_source_url: null,
        image_rights_status: "generated",
      });
    }
  }

  const changed = Object.keys(patch).length > 0;
  if (changed && client) {
    for (const u of uploads) await uploadObject(client, u.path, u.bytes, "image/png");
    const now = new Date().toISOString();
    const { error } = await client
      .from("cards")
      .update({ ...patch, image_updated_at: now, image_updated_by: opts.by })
      .eq("id", card.id);
    if (error) {
      for (const u of uploads) await removeObject(client, u.path);
      throw error;
    }
    const keep = new Set(
      [imageUrl, fallbackUrl].map((u) => storagePathFromPublicUrl(u)).filter(Boolean),
    );
    for (const old of [card.image_url, card.image_fallback_url]) {
      const oldPath = storagePathFromPublicUrl(old);
      if (oldPath && !keep.has(oldPath)) {
        keep.add(oldPath);
        await removeObject(client, oldPath);
      }
    }
  }

  return {
    ...base,
    outcome,
    ...(artUrl ? { artUrl, artPageUrl } : {}),
    ...(art && !art.ok ? { failure: art.reason } : {}),
    changed,
    imageUrl,
    fallbackUrl,
    attempts: art?.attempts ?? [],
  };
}

function isTransient(reason: string): boolean {
  return /network_error|http_error 5\d\d|http_error 429/.test(reason);
}

export function summarize(rows: CardReport[]) {
  const count = (o: ArtOutcome) => rows.filter((r) => r.outcome === o).length;
  return {
    total: rows.length,
    fetched: count("fetched"),
    generated: count("generated"),
    kept: count("kept"),
    skipped: count("skipped"),
    failed: rows.filter((r) => r.failure && r.outcome !== "skipped").length,
    changed: rows.filter((r) => r.changed).length,
  };
}

export function renderReportMarkdown(rows: CardReport[], generatedAt: string): string {
  const s = summarize(rows);
  const lines = [
    "# Card art fetch report",
    "",
    `Generated ${generatedAt}. Issuer art is stored with rights \`unknown\` (dev / test only, see docs/data/ASSETS.md).`,
    "",
    `- Cards: ${s.total}`,
    `- Issuer art fetched: ${s.fetched}`,
    `- Generated fallback used: ${s.generated}`,
    `- Kept previous issuer art after a transient failure: ${s.kept}`,
    `- Skipped (already licensed / issuer_provided): ${s.skipped}`,
    `- Fetch failures: ${s.failed}`,
    `- Rows changed this run: ${s.changed}`,
    "",
    "| Card | Outcome | Issuer image / reason |",
    "| --- | --- | --- |",
  ];
  for (const r of rows) {
    const detail =
      r.outcome === "fetched"
        ? `${r.artUrl}${r.artPageUrl && r.artPageUrl !== r.productUrl ? ` (found on ${r.artPageUrl})` : ""}`
        : r.failure ?? "";
    lines.push(`| \`${r.id}\` | ${r.outcome}${r.changed ? " (updated)" : ""} | ${String(detail).replace(/\|/g, "\\|")} |`);
  }
  return `${lines.join("\n")}\n`;
}

async function loadCards(client: SupabaseClient): Promise<CardRow[]> {
  const { data, error } = await client
    .from("cards")
    .select(
      "id, issuer, name, network, image_url, image_alt, image_source_url, image_rights_status, image_fallback_url",
    )
    .order("issuer")
    .order("name");
  if (error) throw error;
  return (data ?? []) as CardRow[];
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      only: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "no-fetch": { type: "boolean", default: false },
      by: { type: "string", default: "script:assets:fetch-card-art" },
    },
  });
  const client = createServiceClient();
  let cards = await loadCards(client);
  const only = values.only?.split(",").map((s) => s.trim()).filter(Boolean);
  const all = cards;
  if (only?.length) cards = cards.filter((c) => only.includes(c.id));

  const byIssuer = new Map<string, CardRow[]>();
  for (const c of cards) byIssuer.set(c.issuer, [...(byIssuer.get(c.issuer) ?? []), c]);

  const rows: CardReport[] = [];
  // Issuers run in parallel; cards of one issuer run in order so each host
  // sees one request at a time (plus the per-host delay in politeFetch).
  await Promise.all(
    [...byIssuer.entries()].map(async ([issuer, group]) => {
      const siblings = all.filter((c) => c.issuer === issuer);
      for (const card of group) {
        const others = siblings.filter((s) => s.id !== card.id);
        try {
          const row = await processCard(values["dry-run"] ? null : client, card, others, {
            fetch: !values["no-fetch"],
            by: values.by!,
          });
          rows.push(row);
          console.log(`${card.id.padEnd(28)} ${row.outcome}${row.changed ? " (updated)" : ""}${row.failure ? ` — ${row.failure}` : ""}`);
        } catch (err) {
          console.error(`${card.id}: ${(err as Error).message}`);
          process.exitCode = 1;
        }
      }
    }),
  );

  rows.sort((a, b) => a.issuer.localeCompare(b.issuer) || a.name.localeCompare(b.name));
  // Reports are committed; record bucket paths, not the project's storage URL.
  const bucketRef = (url: string | null) => {
    const p = storagePathFromPublicUrl(url);
    return p ? `${ASSET_BUCKET}/${p}` : url;
  };
  for (const r of rows) {
    r.imageUrl = bucketRef(r.imageUrl);
    r.fallbackUrl = bucketRef(r.fallbackUrl);
  }
  const generatedAt = new Date().toISOString();
  await mkdir(REPORT_DIR, { recursive: true });
  const suffix = only?.length || values["dry-run"] ? "partial" : "latest";
  await writeFile(
    path.join(REPORT_DIR, `${suffix}.json`),
    `${JSON.stringify({ generatedAt, summary: summarize(rows), cards: rows }, null, 2)}\n`,
  );
  await writeFile(path.join(REPORT_DIR, `${suffix}.md`), renderReportMarkdown(rows, generatedAt));
  console.log(JSON.stringify(summarize(rows)));
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
