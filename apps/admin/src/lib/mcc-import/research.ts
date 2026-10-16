/**
 * Admin research CSV → finding writes. Validation mirrors the CLI importer's
 * rules but is structured for the console (no shared module with apps/api).
 */
import Papa from "papaparse";
import type { FindingWrite, ImportKind, ImportRejection } from "./types";

const NETWORKS = new Set(["visa", "mastercard", "amex", "visa_mc", "all"]);
const CHANNELS = new Set(["in_store", "online", "pay_at_pump"]);
const CERTAINTIES = new Set([
  "confirmed",
  "varies_by_store",
  "varies_by_network",
  "varies_by_product",
  "category_only",
  "estimate",
  "unknown",
]);
const SOURCE_TYPES = new Set([
  "issuer_merchant_list",
  "cardholder_report",
  "blog",
  "issuer_faq",
  "test_purchase",
]);
const CATEGORIES = new Set([
  "groceries",
  "dining",
  "gas",
  "transit",
  "drugstore",
  "recurring_bills",
  "travel",
  "foreign_currency",
  "entertainment",
  "other",
]);

export type CardIndex = Map<string, { id: string; name: string; network: string | null }>;

function requiredColumns(kind: ImportKind): string[] {
  if (kind === "store_codes") {
    return "chain,wikidata_id,mcc,network,channel,certainty,source_type,url,observed_date,quote".split(
      ",",
    );
  }
  if (kind === "test_purchases") {
    return "date,card,statement_text,mcc_shown,category_shown,screenshot_file".split(",");
  }
  if (kind === "mcc_codes") return ["mcc", "name", "source_url"];
  if (kind === "category_mccs") return ["category", "mcc", "source_url"];
  return ["osm_tag", "mcc", "note"];
}

function need(row: Record<string, string>, key: string): string {
  const v = (row[key] ?? "").trim();
  if (!v) throw new Error(`${key} is required`);
  return v;
}

function mccOk(v: string) {
  if (!/^\d{4}$/.test(v)) throw new Error("mcc must be a 4-digit code");
}

function dateOk(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new Error("date must be YYYY-MM-DD");
  }
}

function urlOk(v: string) {
  if (!/^https?:\/\//i.test(v)) throw new Error("url must be http(s)");
}

/** Map a catalog card network label onto mcc_network enum values. */
export function networkFromCard(network: string | null): string {
  const n = (network ?? "").toLowerCase();
  if (n === "visa") return "visa";
  if (n === "mastercard") return "mastercard";
  if (n === "amex" || n.includes("american")) return "amex";
  return "all";
}

/** Pull chain / store # / city from a statement line when present. */
export function chainFromStatement(statement: string): {
  chain: string;
  store_number: string | null;
  city: string | null;
  location: string | null;
  format: string | null;
} {
  const text = statement.trim();
  const num = text.match(/#(\d+)/)?.[1] ?? null;
  const cleaned = text.replace(/\s*#\d+\s*/, " ").replace(/\s+/g, " ").trim();
  const bits = cleaned.split(" ");
  if (bits.length >= 2 && /^[A-Z]{2}$/.test(bits[bits.length - 1]!)) {
    return {
      chain: bits.slice(0, -2).join(" ") || cleaned,
      store_number: num,
      city: bits[bits.length - 2] ?? null,
      location: cleaned || null,
      format: num ? "numbered" : null,
    };
  }
  return {
    chain: cleaned || text,
    store_number: num,
    city: null,
    location: cleaned || null,
    format: num ? "numbered" : null,
  };
}

function toStoreCode(row: Record<string, string>): FindingWrite {
  const chain = need(row, "chain");
  const mcc = need(row, "mcc");
  mccOk(mcc);
  const network = need(row, "network");
  if (!NETWORKS.has(network)) throw new Error(`network must be one of ${[...NETWORKS].join("|")}`);
  const channel = need(row, "channel");
  if (!CHANNELS.has(channel)) throw new Error(`channel must be one of ${[...CHANNELS].join("|")}`);
  const certainty = need(row, "certainty");
  if (!CERTAINTIES.has(certainty)) throw new Error(`certainty must be one of ${[...CERTAINTIES].join("|")}`);
  const sourceType = need(row, "source_type");
  if (!SOURCE_TYPES.has(sourceType)) {
    throw new Error(`source_type must be one of ${[...SOURCE_TYPES].join("|")}`);
  }
  const url = need(row, "url");
  urlOk(url);
  const observed = need(row, "observed_date");
  dateOk(observed);
  const quote = need(row, "quote");
  return {
    kind: "store_codes",
    idempotencyKey: `${chain.toLowerCase()}|${url}|${network}|${channel}`,
    proposed: {
      chain,
      wikidata_id: (row.wikidata_id ?? "").trim() || null,
      mcc,
      network,
      channel,
      certainty,
      source_type: sourceType,
      url,
      observed_date: observed,
      quote,
    },
  };
}

function toTestPurchase(row: Record<string, string>, cards: CardIndex): FindingWrite {
  const date = need(row, "date");
  dateOk(date);
  const cardName = need(row, "card");
  if (/\d{12,}/.test(cardName)) throw new Error("card must be a catalog name, never a card number");
  const card = cards.get(cardName.toLowerCase());
  if (!card) throw new Error(`unknown card "${cardName}"`);
  const statement = need(row, "statement_text");
  if (/\d{12,}/.test(statement)) throw new Error("statement_text must not contain card numbers");
  const shown = (row.mcc_shown ?? "").trim() || null;
  if (shown) mccOk(shown);
  const parsed = chainFromStatement(statement);
  return {
    kind: "test_purchases",
    idempotencyKey: `${date}|${card.id}|${statement}`,
    proposed: {
      date,
      card: card.name,
      card_id: card.id,
      network: networkFromCard(card.network),
      statement_text: statement,
      mcc_shown: shown,
      category_shown: (row.category_shown ?? "").trim() || null,
      screenshot_file: (row.screenshot_file ?? "").trim() || null,
      ...parsed,
      source_type: "test_purchase",
    },
  };
}

function toMccCode(row: Record<string, string>): FindingWrite {
  const mcc = need(row, "mcc");
  mccOk(mcc);
  const name = need(row, "name");
  const sourceUrl = (row.source_url ?? "").trim() || null;
  if (sourceUrl) urlOk(sourceUrl);
  return {
    kind: "mcc_codes",
    idempotencyKey: `${mcc}|${sourceUrl ?? ""}`,
    proposed: { mcc, name, source_url: sourceUrl },
  };
}

function toCategoryMcc(row: Record<string, string>): FindingWrite {
  const category = need(row, "category");
  if (!CATEGORIES.has(category)) {
    throw new Error(`category must be one of the 10: ${[...CATEGORIES].join(", ")}`);
  }
  const mcc = need(row, "mcc");
  mccOk(mcc);
  const sourceUrl = (row.source_url ?? "").trim() || null;
  if (sourceUrl) urlOk(sourceUrl);
  return {
    kind: "category_mccs",
    idempotencyKey: `${category}|${mcc}|${sourceUrl ?? ""}`,
    proposed: { category, mcc, source_url: sourceUrl },
  };
}

function toStoreTypeMcc(row: Record<string, string>): FindingWrite {
  const osm = need(row, "osm_tag");
  const mcc = need(row, "mcc");
  mccOk(mcc);
  return {
    kind: "store_type_mccs",
    idempotencyKey: `${osm}|${mcc}`,
    proposed: { osm_tag: osm, mcc, note: (row.note ?? "").trim() || null },
  };
}

function buildRow(kind: ImportKind, row: Record<string, string>, cards: CardIndex): FindingWrite {
  switch (kind) {
    case "store_codes":
      return toStoreCode(row);
    case "test_purchases":
      return toTestPurchase(row, cards);
    case "mcc_codes":
      return toMccCode(row);
    case "category_mccs":
      return toCategoryMcc(row);
    case "store_type_mccs":
      return toStoreTypeMcc(row);
  }
}

export function parseResearchCsv(
  kind: ImportKind,
  csvText: string,
  cards: CardIndex = new Map(),
): { writes: FindingWrite[]; rejected: ImportRejection[] } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const missing = requiredColumns(kind).filter((c) => !headers.includes(c));
  if (missing.length) {
    return { writes: [], rejected: [{ row: 0, reason: `missing columns: ${missing.join(", ")}` }] };
  }

  const writes: FindingWrite[] = [];
  const rejected: ImportRejection[] = [];
  parsed.data.forEach((row, idx) => {
    try {
      writes.push(buildRow(kind, row, cards));
    } catch (err) {
      rejected.push({
        row: idx + 2,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });
  return { writes, rejected };
}
