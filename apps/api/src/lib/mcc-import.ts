/**
 * MCC research CSV → merchant_code_findings only.
 * Never writes live mcc_codes / merchant_brands / category_mccs rows.
 * Idempotent upserts keyed per format (see Locked scope for MC1).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CARDS, CATEGORIES, type Category } from "@/domain";

export const IMPORT_KINDS = [
  "store_codes",
  "test_purchases",
  "mcc_codes",
  "category_mccs",
  "store_type_mccs",
] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

export const MCC_NETWORKS = [
  "visa",
  "mastercard",
  "amex",
  "visa_mc",
  "all",
] as const;
export const MCC_CHANNELS = ["in_store", "online", "pay_at_pump"] as const;
export const MCC_CERTAINTY_VALUES = [
  "confirmed",
  "varies_by_store",
  "varies_by_network",
  "varies_by_product",
  "category_only",
  "estimate",
  "unknown",
] as const;
export const MCC_SOURCE_TYPES = [
  "issuer_merchant_list",
  "cardholder_report",
  "blog",
  "issuer_faq",
  "test_purchase",
] as const;

export interface ImportRejection {
  row: number;
  reason: string;
  raw?: Record<string, string>;
}

export interface ImportResult {
  kind: ImportKind;
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: ImportRejection[];
}

export interface FindingWrite {
  kind: ImportKind;
  idempotencyKey: string;
  proposed: Record<string, unknown>;
}

export interface FindingStore {
  /** Return existing proposed jsonb for this kind+key, or null. */
  get(kind: ImportKind, idempotencyKey: string): Promise<Record<string, unknown> | null>;
  /** Insert or replace proposed; returns whether a row was newly inserted. */
  upsert(write: FindingWrite): Promise<"inserted" | "updated" | "unchanged">;
}

const CATEGORY_SET = new Set<string>(CATEGORIES);

function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
}

/** Minimal RFC4180-ish CSV parse (handles quotes and commas). */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  while (i < src.length) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "") || row.length > 1) lines.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "") || row.length > 1) lines.push(row);
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0]!.map((h) => h.trim());
  const rows = lines.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = (cols[c] ?? "").trim();
    }
    return obj;
  });
  return { headers, rows };
}

function requireHeaders(headers: string[], expected: string[]): string | null {
  const missing = expected.filter((h) => !headers.includes(h));
  return missing.length ? `missing columns: ${missing.join(", ")}` : null;
}

function isMcc(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Parse a banking-app statement line into chain / store number / city.
 * Example: `WAL-MART SUPERCENTER #3124 TORONTO ON`
 */
export function parseStatementText(statementText: string): {
  chain: string;
  storeNumber: string | null;
  city: string | null;
  location: string | null;
  format: string | null;
} {
  const raw = statementText.trim().replace(/\s+/g, " ");
  const storeMatch = raw.match(/#(\d+)/);
  const storeNumber = storeMatch?.[1] ?? null;

  // Trailing `CITY ST` (2-letter province/state).
  const cityMatch = raw.match(/\s([A-Z][A-Z\s]*?)\s([A-Z]{2})$/);
  let city: string | null = null;
  let withoutCity = raw;
  if (cityMatch) {
    city = cityMatch[1]!.trim();
    withoutCity = raw.slice(0, cityMatch.index).trim();
  }

  const withoutStore = withoutCity.replace(/\s*#\d+\s*/, " ").trim();
  const chain = withoutStore.replace(/\s+/g, " ");

  let format: string | null = null;
  if (/supercentre|supercenter/i.test(chain)) format = "supercentre";
  else if (/discount/i.test(chain)) format = "discount";

  const location = city;

  return { chain, storeNumber, city, location, format };
}

/** Exact catalog name match; otherwise suggest close names. */
export function resolveCatalogCardName(name: string): {
  cardId: string | null;
  didYouMean: string[];
} {
  const needle = name.trim().toLowerCase();
  const exact = CARDS.find(
    (c) => c.name.toLowerCase() === needle || c.id === needle,
  );
  if (exact) return { cardId: exact.id, didYouMean: [] };

  const scored = CARDS.map((c) => {
    const n = c.name.toLowerCase();
    let score = 0;
    if (n.includes(needle) || needle.includes(n)) score += 2;
    const a = new Set(needle.split(/\s+/));
    const b = new Set(n.split(/\s+/));
    for (const t of a) if (b.has(t)) score += 1;
    return { name: c.name, score };
  })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((s) => s.name);

  return { cardId: null, didYouMean: scored };
}

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

export function validateAndBuildFindings(
  kind: ImportKind,
  csvText: string,
): { writes: FindingWrite[]; rejected: ImportRejection[] } {
  const { headers, rows } = parseCsv(csvText);
  const writes: FindingWrite[] = [];
  const rejected: ImportRejection[] = [];

  const expect: Record<ImportKind, string[]> = {
    store_codes: [
      "chain",
      "wikidata_id",
      "mcc",
      "network",
      "channel",
      "certainty",
      "source_type",
      "url",
      "observed_date",
      "quote",
    ],
    test_purchases: [
      "date",
      "card",
      "statement_text",
      "mcc_shown",
      "category_shown",
      "screenshot_file",
    ],
    mcc_codes: ["mcc", "name", "source_url"],
    category_mccs: ["category", "mcc", "source_url"],
    store_type_mccs: ["osm_tag", "mcc", "note"],
  };

  const headerErr = requireHeaders(headers, expect[kind]);
  if (headerErr) {
    return {
      writes: [],
      rejected: [{ row: 0, reason: headerErr }],
    };
  }

  rows.forEach((raw, idx) => {
    const row = idx + 2; // 1-based + header
    try {
      const write = buildFinding(kind, raw);
      writes.push(write);
    } catch (err) {
      rejected.push({
        row,
        reason: err instanceof Error ? err.message : String(err),
        raw,
      });
    }
  });

  return { writes, rejected };
}

function buildFinding(kind: ImportKind, raw: Record<string, string>): FindingWrite {
  switch (kind) {
    case "store_codes":
      return buildStoreCode(raw);
    case "test_purchases":
      return buildTestPurchase(raw);
    case "mcc_codes":
      return buildMccCode(raw);
    case "category_mccs":
      return buildCategoryMcc(raw);
    case "store_type_mccs":
      return buildStoreTypeMcc(raw);
  }
}

function buildStoreCode(raw: Record<string, string>): FindingWrite {
  const chain = raw.chain?.trim() ?? "";
  if (!chain) throw new Error("chain is required");
  const mcc = raw.mcc?.trim() ?? "";
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const network = raw.network?.trim() ?? "";
  if (!oneOf(network, MCC_NETWORKS)) {
    throw new Error(`network must be one of ${MCC_NETWORKS.join("|")}`);
  }
  const channel = raw.channel?.trim() ?? "";
  if (!oneOf(channel, MCC_CHANNELS)) {
    throw new Error(`channel must be one of ${MCC_CHANNELS.join("|")}`);
  }
  const certainty = raw.certainty?.trim() ?? "";
  if (!oneOf(certainty, MCC_CERTAINTY_VALUES)) {
    throw new Error(`certainty must be one of ${MCC_CERTAINTY_VALUES.join("|")}`);
  }
  const sourceType = raw.source_type?.trim() ?? "";
  if (!oneOf(sourceType, MCC_SOURCE_TYPES)) {
    throw new Error(`source_type must be one of ${MCC_SOURCE_TYPES.join("|")}`);
  }
  const url = raw.url?.trim() ?? "";
  if (!isUrl(url)) throw new Error("url must be http(s)");
  const observedDate = raw.observed_date?.trim() ?? "";
  if (!isDate(observedDate)) throw new Error("observed_date must be YYYY-MM-DD");
  const quote = raw.quote?.trim() ?? "";
  if (!quote) throw new Error("quote is required");

  const proposed = {
    chain,
    wikidata_id: raw.wikidata_id?.trim() || null,
    mcc,
    network,
    channel,
    certainty,
    source_type: sourceType,
    url,
    observed_date: observedDate,
    quote,
  };
  return {
    kind: "store_codes",
    idempotencyKey: `${chain.toLowerCase()}|${url}|${network}|${channel}`,
    proposed,
  };
}

function buildTestPurchase(raw: Record<string, string>): FindingWrite {
  const date = raw.date?.trim() ?? "";
  if (!isDate(date)) throw new Error("date must be YYYY-MM-DD");
  const cardName = raw.card?.trim() ?? "";
  if (!cardName) throw new Error("card is required");
  // Never accept digit sequences that look like PANs.
  if (/\d{12,}/.test(cardName)) {
    throw new Error("card must be a catalog name, never a card number");
  }
  const resolved = resolveCatalogCardName(cardName);
  if (!resolved.cardId) {
    const hint =
      resolved.didYouMean.length > 0
        ? `did you mean: ${resolved.didYouMean.join(", ")}`
        : "no close catalog match";
    throw new Error(`unknown card "${cardName}" (${hint})`);
  }
  const statementText = raw.statement_text?.trim() ?? "";
  if (!statementText) throw new Error("statement_text is required");
  if (/\d{12,}/.test(statementText)) {
    throw new Error("statement_text must not contain card numbers");
  }

  const mccShown = raw.mcc_shown?.trim() || null;
  if (mccShown && !isMcc(mccShown)) throw new Error("mcc_shown must be a 4-digit code");
  const categoryShown = raw.category_shown?.trim() || null;
  const screenshotFile = raw.screenshot_file?.trim() || null;

  const parsed = parseStatementText(statementText);
  const card = CARDS.find((c) => c.id === resolved.cardId)!;
  const network =
    card.network === "Visa"
      ? "visa"
      : card.network === "Mastercard"
        ? "mastercard"
        : card.network === "Amex"
          ? "amex"
          : "all";

  const proposed = {
    date,
    card: card.name,
    card_id: card.id,
    network,
    statement_text: statementText,
    mcc_shown: mccShown,
    category_shown: categoryShown,
    screenshot_file: screenshotFile,
    chain: parsed.chain,
    store_number: parsed.storeNumber,
    city: parsed.city,
    location: parsed.location,
    format: parsed.format,
    source_type: "test_purchase",
  };
  return {
    kind: "test_purchases",
    idempotencyKey: `${date}|${card.id}|${statementText}`,
    proposed,
  };
}

function buildMccCode(raw: Record<string, string>): FindingWrite {
  const mcc = raw.mcc?.trim() ?? "";
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const name = raw.name?.trim() ?? "";
  if (!name) throw new Error("name is required");
  const sourceUrl = raw.source_url?.trim() || null;
  if (sourceUrl && !isUrl(sourceUrl)) throw new Error("source_url must be http(s)");
  return {
    kind: "mcc_codes",
    idempotencyKey: `${mcc}|${sourceUrl ?? ""}`,
    proposed: { mcc, name, source_url: sourceUrl },
  };
}

function buildCategoryMcc(raw: Record<string, string>): FindingWrite {
  const category = raw.category?.trim() ?? "";
  if (!isCategory(category)) {
    throw new Error(`category must be one of the 10: ${CATEGORIES.join(", ")}`);
  }
  const mcc = raw.mcc?.trim() ?? "";
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const sourceUrl = raw.source_url?.trim() || null;
  if (sourceUrl && !isUrl(sourceUrl)) throw new Error("source_url must be http(s)");
  return {
    kind: "category_mccs",
    idempotencyKey: `${category}|${mcc}|${sourceUrl ?? ""}`,
    proposed: { category, mcc, source_url: sourceUrl },
  };
}

function buildStoreTypeMcc(raw: Record<string, string>): FindingWrite {
  const osmTag = raw.osm_tag?.trim() ?? "";
  if (!osmTag) throw new Error("osm_tag is required");
  const mcc = raw.mcc?.trim() ?? "";
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const note = raw.note?.trim() || null;
  return {
    kind: "store_type_mccs",
    idempotencyKey: `${osmTag}|${mcc}`,
    proposed: { osm_tag: osmTag, mcc, note },
  };
}

/** Map CSV kind → DB enum (store_codes → store_code, …). */
export function findingKindDb(kind: ImportKind): string {
  switch (kind) {
    case "store_codes":
      return "store_code";
    case "test_purchases":
      return "test_purchase";
    case "mcc_codes":
      return "mcc_code";
    case "category_mccs":
      return "category_mcc";
    case "store_type_mccs":
      return "store_type_mcc";
  }
}

export function createSupabaseFindingStore(
  client?: SupabaseClient,
): FindingStore {
  const supabase =
    client ??
    (() => {
      const url = process.env.SUPABASE_URL?.trim();
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !key) {
        throw new Error(
          "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to import",
        );
      }
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();

  return {
    async get(kind, idempotencyKey) {
      const { data, error } = await supabase
        .from("merchant_code_findings")
        .select("proposed")
        .eq("kind", findingKindDb(kind))
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.proposed as Record<string, unknown> | null) ?? null;
    },
    async upsert(write) {
      const dbKind = findingKindDb(write.kind);
      const existing = await this.get(write.kind, write.idempotencyKey);
      if (existing && stableJson(existing) === stableJson(write.proposed)) {
        return "unchanged";
      }
      const { error } = await supabase.from("merchant_code_findings").upsert(
        {
          kind: dbKind,
          idempotency_key: write.idempotencyKey,
          proposed: write.proposed,
          review_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kind,idempotency_key" },
      );
      if (error) throw new Error(error.message);
      return existing ? "updated" : "inserted";
    },
  };
}

/** In-memory store for unit tests / dry admin previews. */
export function createMemoryFindingStore(
  seed: FindingWrite[] = [],
): FindingStore & { rows: Map<string, FindingWrite> } {
  const rows = new Map<string, FindingWrite>();
  for (const w of seed) {
    rows.set(`${w.kind}|${w.idempotencyKey}`, w);
  }
  return {
    rows,
    async get(kind, key) {
      return rows.get(`${kind}|${key}`)?.proposed ?? null;
    },
    async upsert(write) {
      const k = `${write.kind}|${write.idempotencyKey}`;
      const existing = rows.get(k);
      if (existing && stableJson(existing.proposed) === stableJson(write.proposed)) {
        return "unchanged";
      }
      rows.set(k, write);
      return existing ? "updated" : "inserted";
    },
  };
}

/**
 * Validate CSV and write findings. Bad rows are rejected with a reason; the
 * rest still import. Callable from CLI and the admin console.
 */
export async function importMccCsv(
  kind: ImportKind,
  csvText: string,
  store: FindingStore,
): Promise<ImportResult> {
  const { writes, rejected } = validateAndBuildFindings(kind, csvText);
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const write of writes) {
    const outcome = await store.upsert(write);
    if (outcome === "inserted") inserted += 1;
    else if (outcome === "updated") updated += 1;
    else unchanged += 1;
  }

  return { kind, inserted, updated, unchanged, rejected };
}

export function isImportKind(value: string): value is ImportKind {
  return (IMPORT_KINDS as readonly string[]).includes(value);
}
