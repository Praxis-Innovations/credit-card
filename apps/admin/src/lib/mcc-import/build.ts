import { parseCsv } from "./csv";
import type { FindingWrite, ImportKind, ImportRejection } from "./types";

const MCC_NETWORKS = ["visa", "mastercard", "amex", "visa_mc", "all"] as const;
const MCC_CHANNELS = ["in_store", "online", "pay_at_pump"] as const;
const MCC_CERTAINTY = [
  "confirmed",
  "varies_by_store",
  "varies_by_network",
  "varies_by_product",
  "category_only",
  "estimate",
  "unknown",
] as const;
const MCC_SOURCE_TYPES = [
  "issuer_merchant_list",
  "cardholder_report",
  "blog",
  "issuer_faq",
  "test_purchase",
] as const;
const CATEGORIES = [
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
] as const;

export type CardLookup = {
  byName: Map<string, { id: string; name: string; network: string | null }>;
};

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

function requireField(raw: Record<string, string>, key: string): string {
  const value = raw[key]?.trim() ?? "";
  if (!value) throw new Error(`${key} is required`);
  return value;
}

/** Rough parse of statement lines like `WAL-MART #3124 TORONTO ON`. */
export function parseStatementText(statement: string): {
  chain: string;
  storeNumber: string | null;
  city: string | null;
  location: string | null;
  format: string | null;
} {
  const text = statement.trim();
  const storeMatch = text.match(/#(\d+)/);
  const storeNumber = storeMatch?.[1] ?? null;
  const withoutStore = text.replace(/\s*#\d+\s*/, " ").replace(/\s+/g, " ").trim();
  const parts = withoutStore.split(" ");
  let city: string | null = null;
  let chain = withoutStore;
  if (parts.length >= 2 && /^[A-Z]{2}$/.test(parts[parts.length - 1]!)) {
    city = parts[parts.length - 2] ?? null;
    chain = parts.slice(0, -2).join(" ") || withoutStore;
  }
  return {
    chain: chain || text,
    storeNumber,
    city,
    location: withoutStore || null,
    format: storeNumber ? "numbered" : null,
  };
}

function cardNetworkDb(network: string | null): string {
  if (!network) return "all";
  const n = network.toLowerCase();
  if (n === "visa") return "visa";
  if (n === "mastercard") return "mastercard";
  if (n === "amex" || n === "american express") return "amex";
  return "all";
}

function buildStoreCode(raw: Record<string, string>): FindingWrite {
  const chain = requireField(raw, "chain");
  const mcc = requireField(raw, "mcc");
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const network = requireField(raw, "network");
  if (!oneOf(network, MCC_NETWORKS)) {
    throw new Error(`network must be one of ${MCC_NETWORKS.join("|")}`);
  }
  const channel = requireField(raw, "channel");
  if (!oneOf(channel, MCC_CHANNELS)) {
    throw new Error(`channel must be one of ${MCC_CHANNELS.join("|")}`);
  }
  const certainty = requireField(raw, "certainty");
  if (!oneOf(certainty, MCC_CERTAINTY)) {
    throw new Error(`certainty must be one of ${MCC_CERTAINTY.join("|")}`);
  }
  const sourceType = requireField(raw, "source_type");
  if (!oneOf(sourceType, MCC_SOURCE_TYPES)) {
    throw new Error(`source_type must be one of ${MCC_SOURCE_TYPES.join("|")}`);
  }
  const url = requireField(raw, "url");
  if (!isUrl(url)) throw new Error("url must be http(s)");
  const observedDate = requireField(raw, "observed_date");
  if (!isDate(observedDate)) throw new Error("observed_date must be YYYY-MM-DD");
  const quote = requireField(raw, "quote");
  return {
    kind: "store_codes",
    idempotencyKey: `${chain.toLowerCase()}|${url}|${network}|${channel}`,
    proposed: {
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
    },
  };
}

function buildTestPurchase(raw: Record<string, string>, cards: CardLookup): FindingWrite {
  const date = requireField(raw, "date");
  if (!isDate(date)) throw new Error("date must be YYYY-MM-DD");
  const cardName = requireField(raw, "card");
  if (/\d{12,}/.test(cardName)) throw new Error("card must be a catalog name, never a card number");
  const card = cards.byName.get(cardName.toLowerCase());
  if (!card) throw new Error(`unknown card "${cardName}"`);
  const statementText = requireField(raw, "statement_text");
  if (/\d{12,}/.test(statementText)) {
    throw new Error("statement_text must not contain card numbers");
  }
  const mccShown = raw.mcc_shown?.trim() || null;
  if (mccShown && !isMcc(mccShown)) throw new Error("mcc_shown must be a 4-digit code");
  const parsed = parseStatementText(statementText);
  return {
    kind: "test_purchases",
    idempotencyKey: `${date}|${card.id}|${statementText}`,
    proposed: {
      date,
      card: card.name,
      card_id: card.id,
      network: cardNetworkDb(card.network),
      statement_text: statementText,
      mcc_shown: mccShown,
      category_shown: raw.category_shown?.trim() || null,
      screenshot_file: raw.screenshot_file?.trim() || null,
      chain: parsed.chain,
      store_number: parsed.storeNumber,
      city: parsed.city,
      location: parsed.location,
      format: parsed.format,
      source_type: "test_purchase",
    },
  };
}

function buildMccCode(raw: Record<string, string>): FindingWrite {
  const mcc = requireField(raw, "mcc");
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  const name = requireField(raw, "name");
  const sourceUrl = raw.source_url?.trim() || null;
  if (sourceUrl && !isUrl(sourceUrl)) throw new Error("source_url must be http(s)");
  return {
    kind: "mcc_codes",
    idempotencyKey: `${mcc}|${sourceUrl ?? ""}`,
    proposed: { mcc, name, source_url: sourceUrl },
  };
}

function buildCategoryMcc(raw: Record<string, string>): FindingWrite {
  const category = requireField(raw, "category");
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`category must be one of the 10: ${CATEGORIES.join(", ")}`);
  }
  const mcc = requireField(raw, "mcc");
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
  const osmTag = requireField(raw, "osm_tag");
  const mcc = requireField(raw, "mcc");
  if (!isMcc(mcc)) throw new Error("mcc must be a 4-digit code");
  return {
    kind: "store_type_mccs",
    idempotencyKey: `${osmTag}|${mcc}`,
    proposed: { osm_tag: osmTag, mcc, note: raw.note?.trim() || null },
  };
}

const EXPECTED_HEADERS: Record<ImportKind, string[]> = {
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
  test_purchases: ["date", "card", "statement_text", "mcc_shown", "category_shown", "screenshot_file"],
  mcc_codes: ["mcc", "name", "source_url"],
  category_mccs: ["category", "mcc", "source_url"],
  store_type_mccs: ["osm_tag", "mcc", "note"],
};

export function validateAndBuildFindings(
  kind: ImportKind,
  csvText: string,
  cards: CardLookup = { byName: new Map() },
): { writes: FindingWrite[]; rejected: ImportRejection[] } {
  const { headers, rows } = parseCsv(csvText);
  const writes: FindingWrite[] = [];
  const rejected: ImportRejection[] = [];

  const headerErr = requireHeaders(headers, EXPECTED_HEADERS[kind]);
  if (headerErr) {
    return { writes: [], rejected: [{ row: 0, reason: headerErr }] };
  }

  rows.forEach((raw, idx) => {
    const row = idx + 2;
    try {
      switch (kind) {
        case "store_codes":
          writes.push(buildStoreCode(raw));
          break;
        case "test_purchases":
          writes.push(buildTestPurchase(raw, cards));
          break;
        case "mcc_codes":
          writes.push(buildMccCode(raw));
          break;
        case "category_mccs":
          writes.push(buildCategoryMcc(raw));
          break;
        case "store_type_mccs":
          writes.push(buildStoreTypeMcc(raw));
          break;
      }
    } catch (err) {
      rejected.push({
        row,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return { writes, rejected };
}
