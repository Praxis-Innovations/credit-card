import type { PillTone } from "@/lib/sources/present";
import { formatDate } from "@/lib/sources/present";
import {
  CATEGORY_LABELS,
  CONFIRMED_EVIDENCE_THRESHOLD,
  DISPLAY_CATEGORIES,
  type CertaintyFilter,
  type DisplayCategory,
  type EvidenceRow,
  type MccCertainty,
  type MerchantBrandRow,
  type StoreCodeListItem,
} from "./types";

const CERTAINTY_LABELS: Record<MccCertainty, string> = {
  confirmed: "Confirmed",
  varies_by_store: "Varies by store",
  varies_by_network: "Varies by network",
  varies_by_product: "Varies by product",
  category_only: "Category only",
  estimate: "Estimate",
  unknown: "Unknown",
};

const VARIES: ReadonlySet<string> = new Set([
  "varies_by_store",
  "varies_by_network",
  "varies_by_product",
]);

export function certaintyLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  if (value === "varies_by_store" || value === "varies_by_network") {
    // Design board shows a combined label when both apply; keep per-enum otherwise.
    if (value === "varies_by_network") return "Varies by store and network";
  }
  return CERTAINTY_LABELS[value as MccCertainty] ?? value.replaceAll("_", " ");
}

export function certaintyPill(certainty: string): { label: string; tone: PillTone } {
  if (certainty === "confirmed") return { label: certaintyLabel(certainty), tone: "ok" };
  if (VARIES.has(certainty)) return { label: certaintyLabel(certainty), tone: "warn" };
  if (certainty === "category_only") {
    return { label: certaintyLabel(certainty), tone: "neutral" };
  }
  if (certainty === "estimate") return { label: "Estimate", tone: "neutral" };
  return { label: certaintyLabel(certainty), tone: "neutral" };
}

export function categoryLabel(category: string): string {
  if ((DISPLAY_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_LABELS[category as DisplayCategory];
  }
  return category.replaceAll("_", " ");
}

export function sourceTypeLabel(value: string | null | undefined): string {
  if (!value) return "Unknown source";
  switch (value) {
    case "issuer_merchant_list":
      return "Issuer merchant list";
    case "cardholder_report":
      return "Cardholder report";
    case "issuer_faq":
      return "Issuer FAQ";
    case "test_purchase":
      return "Test purchase";
    case "blog":
      return "Blog";
    default:
      return value.replaceAll("_", " ");
  }
}

export function networkLabel(network: string): string {
  switch (network) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "Amex";
    case "visa_mc":
      return "Visa / Mastercard";
    default:
      return "All networks";
  }
}

export function wikidataFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const m = notes.match(/wikidata:(\S+)/i);
  return m?.[1] ?? null;
}

export function codeDisplay(brand: MerchantBrandRow, evidence: readonly EvidenceRow[]): string {
  const codes = new Set<string>();
  if (brand.mcc) codes.add(brand.mcc);
  if (brand.amex_mcc) codes.add(brand.amex_mcc);
  for (const e of evidence) {
    if (e.mcc) codes.add(e.mcc);
    if (e.mcc_shown) codes.add(e.mcc_shown);
  }
  if (codes.size === 0) return "—";
  return [...codes].sort().join(" or ");
}

export function needsEvidence(evidenceCount: number): boolean {
  return evidenceCount < CONFIRMED_EVIDENCE_THRESHOLD;
}

export function latestEvidenceLabel(evidence: readonly EvidenceRow[]): string | null {
  if (evidence.length === 0) return null;
  const sorted = [...evidence].sort((a, b) => {
    const da = a.observed_date ?? a.created_at;
    const db = b.observed_date ?? b.created_at;
    return db.localeCompare(da);
  });
  const top = sorted[0]!;
  const when = top.observed_date ? formatDate(top.observed_date) : formatDate(top.created_at);
  return `${when} · ${sourceTypeLabel(top.source_type)}`;
}

export function toListItem(
  brand: MerchantBrandRow,
  evidence: readonly EvidenceRow[],
  pendingReview: boolean,
): StoreCodeListItem {
  const evidence_count = evidence.length;
  return {
    ...brand,
    code_display: codeDisplay(brand, evidence),
    category_label: categoryLabel(brand.category),
    evidence_count,
    latest_evidence_label: latestEvidenceLabel(evidence),
    needs_evidence: needsEvidence(evidence_count),
    pending_review: pendingReview,
  };
}

export function matchesCertaintyFilter(item: StoreCodeListItem, filter: CertaintyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs_evidence") return item.needs_evidence;
  if (filter === "varies") return VARIES.has(item.certainty);
  return item.certainty === filter;
}

export function filterStoreCodes(
  items: readonly StoreCodeListItem[],
  opts: { query: string; category: string; certainty: CertaintyFilter },
): StoreCodeListItem[] {
  const q = opts.query.trim().toLowerCase();
  return items.filter((item) => {
    if (!matchesCertaintyFilter(item, opts.certainty)) return false;
    if (opts.category && item.category !== opts.category) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.mcc?.includes(q) ?? false) ||
      (item.amex_mcc?.includes(q) ?? false) ||
      item.code_display.toLowerCase().includes(q)
    );
  });
}

export function certaintyCounts(
  items: readonly StoreCodeListItem[],
): Record<CertaintyFilter, number> {
  const counts: Record<CertaintyFilter, number> = {
    all: items.length,
    confirmed: 0,
    varies: 0,
    category_only: 0,
    estimate: 0,
    unknown: 0,
    needs_evidence: 0,
  };
  for (const item of items) {
    if (item.certainty === "confirmed") counts.confirmed += 1;
    else if (VARIES.has(item.certainty)) counts.varies += 1;
    else if (item.certainty === "category_only") counts.category_only += 1;
    else if (item.certainty === "estimate") counts.estimate += 1;
    else if (item.certainty === "unknown") counts.unknown += 1;
    if (item.needs_evidence) counts.needs_evidence += 1;
  }
  return counts;
}

export function evidenceCountLabel(count: number): string {
  if (count === 0) return "0 sources";
  if (count === 1) return "1 source";
  return `${count} sources`;
}

/** User-facing blurb generated from certainty + live codes (not edited by hand). */
export function appTellsUsersCopy(brand: MerchantBrandRow, evidence: readonly EvidenceRow[]): string {
  const name = brand.name;
  const cat = categoryLabel(brand.category);
  const codes = codeDisplay(brand, evidence);
  switch (brand.certainty) {
    case "confirmed":
      return `${name} usually counts as ${cat}${codes !== "—" ? ` (${codes})` : ""}.`;
    case "varies_by_store":
      return `${name}'s code depends on the store. When the location isn't known, recommendations use the lower-earning code${codes !== "—" ? ` (${codes})` : ""}.`;
    case "varies_by_network":
      return `${name}'s code depends on the store and your card${codes !== "—" ? ` (${codes})` : ""}. Grocery bonuses may not apply on every network.`;
    case "varies_by_product":
      return `${name}'s code depends on the product or service. Recommendations use the category rate when the product isn't known.`;
    case "category_only":
      return `We only know the category for ${name}: ${cat}. Recommendations use that category's rate.`;
    case "estimate":
      return `We estimate ${name} uses code ${codes !== "—" ? codes : "unknown"} (${cat}). This isn't confirmed yet.`;
    default:
      return `We don't have a confirmed code for ${name} yet. Recommendations use the base rate.`;
  }
}

export type FormatNetworkCell = {
  mcc: string | null;
  sourceCount: number;
  latestYear: string | null;
  confirmed: boolean;
};

export type FormatNetworkRow = {
  format: string;
  mastercard: FormatNetworkCell;
  visa: FormatNetworkCell;
  amex: FormatNetworkCell;
};

function emptyCell(): FormatNetworkCell {
  return { mcc: null, sourceCount: 0, latestYear: null, confirmed: false };
}

function networkBucket(network: string): "mastercard" | "visa" | "amex" | "both" | null {
  if (network === "amex") return "amex";
  if (network === "visa") return "visa";
  if (network === "mastercard") return "mastercard";
  if (network === "visa_mc" || network === "all") return "both";
  return null;
}

function yearOf(e: EvidenceRow): string | null {
  const d = e.observed_date ?? e.created_at;
  return d.slice(0, 4) || null;
}

/** Pivot evidence into store-format × network cells for the detail table. */
export function codesByFormatAndNetwork(evidence: readonly EvidenceRow[]): FormatNetworkRow[] {
  const byFormat = new Map<string, EvidenceRow[]>();
  for (const e of evidence) {
    const format = (e.format?.trim() || e.location?.trim() || "All stores").replace(/\s+/g, " ");
    const list = byFormat.get(format) ?? [];
    list.push(e);
    byFormat.set(format, list);
  }

  const rows: FormatNetworkRow[] = [];
  for (const [format, rowsForFormat] of [...byFormat.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const row: FormatNetworkRow = {
      format,
      mastercard: emptyCell(),
      visa: emptyCell(),
      amex: emptyCell(),
    };
    fillNetworkCells(row, rowsForFormat);
    rows.push(row);
  }
  return rows;
}

function fillNetworkCells(row: FormatNetworkRow, evidence: readonly EvidenceRow[]) {
  for (const net of ["mastercard", "visa", "amex"] as const) {
    const hits = evidence.filter((e) => evidenceAppliesToNetwork(e.network, net));
    if (hits.length === 0) continue;
    row[net] = summarizeCell(hits);
  }
}

function evidenceAppliesToNetwork(
  network: string,
  target: "mastercard" | "visa" | "amex",
): boolean {
  const bucket = networkBucket(network);
  if (target === "amex") return bucket === "amex";
  if (bucket === "both") return true;
  return bucket === target;
}

function summarizeCell(hits: readonly EvidenceRow[]): FormatNetworkCell {
  const mccs = [
    ...new Set(hits.map((h) => h.mcc ?? h.mcc_shown).filter((m): m is string => Boolean(m))),
  ];
  const years = hits.map(yearOf).filter((y): y is string => Boolean(y));
  return {
    mcc: mccs[0] ?? null,
    sourceCount: hits.length,
    latestYear: years.sort().at(-1) ?? null,
    confirmed: hits.length >= CONFIRMED_EVIDENCE_THRESHOLD && mccs.length === 1,
  };
}

export type EvidenceListItem = EvidenceRow & {
  source_label: string;
  applies_label: string;
  conflict_note: string | null;
};

/** Flag evidence whose MCC disagrees with the majority for the same applies-to key. */
export function presentEvidenceList(evidence: readonly EvidenceRow[]): EvidenceListItem[] {
  const byKey = new Map<string, string[]>();
  for (const e of evidence) {
    const key = `${e.format ?? ""}|${e.network}|${e.channel}`;
    const mcc = e.mcc ?? e.mcc_shown;
    if (!mcc) continue;
    const list = byKey.get(key) ?? [];
    list.push(mcc);
    byKey.set(key, list);
  }

  const majority = new Map<string, string>();
  for (const [key, mccs] of byKey) {
    const tallies = new Map<string, number>();
    for (const m of mccs) tallies.set(m, (tallies.get(m) ?? 0) + 1);
    const top = [...tallies.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) majority.set(key, top[0]);
  }

  return [...evidence]
    .sort((a, b) => (b.observed_date ?? b.created_at).localeCompare(a.observed_date ?? a.created_at))
    .map((e) => {
      const key = `${e.format ?? ""}|${e.network}|${e.channel}`;
      const mcc = e.mcc ?? e.mcc_shown;
      const maj = majority.get(key);
      const conflict =
        mcc && maj && mcc !== maj
          ? "Conflicts with other sources for this format and network; not used on its own"
          : null;
      const parts = [
        e.format?.trim() || e.location?.trim() || "All stores",
        networkLabel(e.network),
      ];
      return {
        ...e,
        source_label: evidenceSourceTitle(e),
        applies_label: parts.join(" · "),
        conflict_note: conflict,
      };
    });
}

function evidenceSourceTitle(e: EvidenceRow): string {
  if (e.source_type === "test_purchase") {
    return e.statement_text?.trim() || "Test purchase";
  }
  if (e.url) {
    try {
      return new URL(e.url).hostname.replace(/^www\./, "");
    } catch {
      return e.url;
    }
  }
  return sourceTypeLabel(e.source_type);
}

export function cellSourceLabel(cell: FormatNetworkCell): string {
  if (!cell.mcc) return "Unknown";
  if (cell.confirmed) return `${cell.sourceCount} sources`;
  if (cell.sourceCount === 1 && cell.latestYear) {
    return `1 source, ${cell.latestYear}`;
  }
  return evidenceCountLabel(cell.sourceCount);
}
