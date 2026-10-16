import { CARDS, CATEGORIES, type Category } from "@/domain";
import { parseCsv } from "./mcc-import-csv";
import { parseStatementText, resolveCatalogCardName } from "./mcc-import-shared";
import type { FindingWrite, ImportKind, ImportRejection } from "./mcc-import-types";

const MCC_NETWORKS = [
  "visa",
  "mastercard",
  "amex",
  "visa_mc",
  "all",
] as const;
const MCC_CHANNELS = ["in_store", "online", "pay_at_pump"] as const;
const MCC_CERTAINTY_VALUES = [
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

const CATEGORY_SET = new Set<string>(CATEGORIES);

function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
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

function requireField(raw: Record<string, string>, key: string): string {
  const value = raw[key]?.trim() ?? "";
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function validateStoreCodeFields(raw: Record<string, string>) {
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
  if (!oneOf(certainty, MCC_CERTAINTY_VALUES)) {
    throw new Error(`certainty must be one of ${MCC_CERTAINTY_VALUES.join("|")}`);
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
  return { chain, mcc, network, channel, certainty, sourceType, url, observedDate, quote };
}

function buildStoreCode(raw: Record<string, string>): FindingWrite {
  const v = validateStoreCodeFields(raw);
  const proposed = {
    chain: v.chain,
    wikidata_id: raw.wikidata_id?.trim() || null,
    mcc: v.mcc,
    network: v.network,
    channel: v.channel,
    certainty: v.certainty,
    source_type: v.sourceType,
    url: v.url,
    observed_date: v.observedDate,
    quote: v.quote,
  };
  return {
    kind: "store_codes",
    idempotencyKey: `${v.chain.toLowerCase()}|${v.url}|${v.network}|${v.channel}`,
    proposed,
  };
}

function cardNetworkDb(card: (typeof CARDS)[number]): string {
  if (card.network === "Visa") return "visa";
  if (card.network === "Mastercard") return "mastercard";
  if (card.network === "Amex") return "amex";
  return "all";
}

function validateTestPurchaseCard(cardName: string) {
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
  return resolved.cardId;
}

function buildTestPurchase(raw: Record<string, string>): FindingWrite {
  const date = requireField(raw, "date");
  if (!isDate(date)) throw new Error("date must be YYYY-MM-DD");
  const cardId = validateTestPurchaseCard(requireField(raw, "card"));
  const statementText = requireField(raw, "statement_text");
  if (/\d{12,}/.test(statementText)) {
    throw new Error("statement_text must not contain card numbers");
  }

  const mccShown = raw.mcc_shown?.trim() || null;
  if (mccShown && !isMcc(mccShown)) throw new Error("mcc_shown must be a 4-digit code");
  const categoryShown = raw.category_shown?.trim() || null;
  const screenshotFile = raw.screenshot_file?.trim() || null;

  const parsed = parseStatementText(statementText);
  const card = CARDS.find((c) => c.id === cardId)!;
  const proposed = {
    date,
    card: card.name,
    card_id: card.id,
    network: cardNetworkDb(card),
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
  if (!isCategory(category)) {
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
  const note = raw.note?.trim() || null;
  return {
    kind: "store_type_mccs",
    idempotencyKey: `${osmTag}|${mcc}`,
    proposed: { osm_tag: osmTag, mcc, note },
  };
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

export function validateAndBuildFindings(
  kind: ImportKind,
  csvText: string,
): { writes: FindingWrite[]; rejected: ImportRejection[] } {
  const { headers, rows } = parseCsv(csvText);
  const writes: FindingWrite[] = [];
  const rejected: ImportRejection[] = [];

  const headerErr = requireHeaders(headers, EXPECTED_HEADERS[kind]);
  if (headerErr) {
    return {
      writes: [],
      rejected: [{ row: 0, reason: headerErr }],
    };
  }

  rows.forEach((raw, idx) => {
    const row = idx + 2;
    try {
      writes.push(buildFinding(kind, raw));
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
