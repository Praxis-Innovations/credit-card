import type { PillTone } from "@/lib/sources/present";
import type {
  DiffKind,
  ExtractedEarnRate,
  Extraction,
  FieldCheck,
  FieldChange,
  PendingFinding,
} from "./types";

export type FieldRow = {
  key: string;
  label: string;
  /** Current `cards` value as of the crawl; null when the card is not in the catalog. */
  current: string | null;
  proposed: string;
  quote: string | null;
  check: FieldCheck | null;
  /** True when the proposed value differs from the catalog (or the card is new). */
  changed: boolean;
};

export const DIFF_LABELS: Record<DiffKind, { label: string; tone: PillTone }> = {
  new: { label: "New card", tone: "warn" },
  changed: { label: "Changed", tone: "neutral" },
  unchanged: { label: "No changes", tone: "ok" },
  possibly_discontinued: { label: "Possibly discontinued", tone: "bad" },
};

function show(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function showList(values: string[] | null | undefined): string {
  if (!values || values.length === 0) return "none";
  return values.join(", ");
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function rateLabel(e: ExtractedEarnRate, i: number, rates: ExtractedEarnRate[]): string {
  const base = categoryLabel(e.category);
  const same = rates.filter((r) => r.category === e.category).length > 1;
  if (!same) return base;
  const hint = e.description?.trim() || e.merchants?.[0] || e.mcc_source || `#${i + 1}`;
  return `${base} (${hint})`;
}

type Candidate = { label: string; value: string; quote: string | null; checkField: string | null };

const OPTIONAL_RULE_SUFFIXES = [
  ".mccs",
  ".merchants",
  ".mcc_source",
  ".exclusions",
  ".cap_amount",
  ".cap_period",
  ".cap_group",
  ".rate_after_cap",
  ".tier_threshold",
  ".valid_from",
  ".valid_to",
  ".source_url",
  ".new_cardholders_only",
] as const;

function isOptionalRuleKey(key: string): boolean {
  if (key.startsWith("promotion.")) return true;
  if (key === "welcome_bonus.rate") return true;
  if (key === "welcome_bonus.valid_from" || key === "welcome_bonus.valid_to") return true;
  if (key === "welcome_bonus.new_cardholders_only") return true;
  return OPTIONAL_RULE_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function add(out: Map<string, Candidate>, row: Candidate & { key: string }) {
  // Skip empty optional rule fields so the queue stays focused.
  if (row.value === "none" && isOptionalRuleKey(row.key)) return;
  out.set(row.key, { label: row.label, value: row.value, quote: row.quote, checkField: row.checkField });
}

function candidatesFor(x: Extraction): Map<string, Candidate> {
  const out = new Map<string, Candidate>();
  if (x.card_name) out.set("name", { label: "Card name", value: x.card_name.value, quote: x.card_name.quote, checkField: "card_name" });
  if (x.network) out.set("network", { label: "Network", value: x.network.value, quote: x.network.quote, checkField: "network" });
  if (x.annual_fee) {
    out.set("annual_fee", { label: "Annual fee ($)", value: String(x.annual_fee.value), quote: x.annual_fee.quote, checkField: "annual_fee" });
  }
  if (x.welcome_bonus) {
    const wb = x.welcome_bonus;
    const q = wb.quote;
    const checkField = "welcome_bonus";
    add(out, { key: "welcome_bonus.points", label: "Welcome bonus (points)", value: show(wb.value.points), quote: q, checkField });
    add(out, { key: "welcome_bonus.rate", label: "Welcome bonus (rate)", value: show(wb.value.rate), quote: q, checkField });
    add(out, { key: "welcome_bonus.valid_from", label: "Welcome bonus starts", value: show(wb.value.valid_from), quote: q, checkField });
    add(out, { key: "welcome_bonus.valid_to", label: "Welcome bonus ends", value: show(wb.value.valid_to), quote: q, checkField });
    add(out, {
      key: "welcome_bonus.new_cardholders_only",
      label: "Welcome bonus: new cardholders only",
      value: show(wb.value.new_cardholders_only),
      quote: q,
      checkField,
    });
  }
  addEarnRateCandidates(out, x.earn_rates ?? []);
  addPromotionCandidates(out, x.promotions ?? []);
  return out;
}

function addEarnRateCandidates(out: Map<string, Candidate>, rates: ExtractedEarnRate[]) {
  rates.forEach((e, i) => {
    const key = `earn_rate.${e.category}`;
    const prev = out.get(key);
    // The diff uses the highest stated rate per category.
    if (!prev || e.rate > Number(prev.value)) {
      out.set(key, {
        label: `Earn rate: ${categoryLabel(e.category)}`,
        value: String(e.rate),
        quote: e.quote,
        checkField: `earn_rates[${i}] ${e.category}`,
      });
    }
    const label = rateLabel(e, i, rates);
    const check = `earn_rates[${i}] ${e.category}`;
    const prefix = `earn_rates[${i}]`;
    const q = e.quote;
    add(out, { key: `${prefix}.mccs`, label: `${label}: MCCs`, value: showList(e.mccs), quote: q, checkField: `${check}.mccs` });
    add(out, { key: `${prefix}.merchants`, label: `${label}: merchants`, value: showList(e.merchants), quote: q, checkField: `${check}.merchants` });
    add(out, { key: `${prefix}.mcc_source`, label: `${label}: MCC source`, value: show(e.mcc_source), quote: q, checkField: `${check}.mcc_source` });
    add(out, { key: `${prefix}.exclusions`, label: `${label}: exclusions`, value: showList(e.exclusions), quote: q, checkField: `${check}.exclusions` });
    add(out, { key: `${prefix}.cap_amount`, label: `${label}: cap amount`, value: show(e.cap_amount), quote: q, checkField: `${check}.cap_amount` });
    add(out, { key: `${prefix}.cap_period`, label: `${label}: cap period`, value: show(e.cap_period), quote: q, checkField: check });
    add(out, { key: `${prefix}.cap_group`, label: `${label}: cap group`, value: show(e.cap_group), quote: q, checkField: check });
    add(out, { key: `${prefix}.rate_after_cap`, label: `${label}: rate after cap`, value: show(e.rate_after_cap), quote: q, checkField: check });
    add(out, { key: `${prefix}.tier_threshold`, label: `${label}: spend tier`, value: show(e.tier_threshold), quote: q, checkField: `${check}.tier_threshold` });
    add(out, { key: `${prefix}.valid_from`, label: `${label}: starts`, value: show(e.valid_from), quote: q, checkField: check });
    add(out, { key: `${prefix}.valid_to`, label: `${label}: ends`, value: show(e.valid_to), quote: q, checkField: check });
    add(out, { key: `${prefix}.source_url`, label: `${label}: source URL`, value: show(e.source_url), quote: q, checkField: check });
  });
}

function addPromotionCandidates(out: Map<string, Candidate>, promotions: NonNullable<Extraction["promotions"]>) {
  promotions.forEach((p, i) => {
    const checkField = `promotions[${i}]`;
    const prefix = `promotion.${i}`;
    const q = p.quote;
    add(out, { key: `${prefix}.summary`, label: `Promotion: ${p.summary}`, value: p.summary, quote: q, checkField });
    add(out, { key: `${prefix}.rate`, label: `Promotion rate: ${p.summary}`, value: show(p.rate), quote: q, checkField });
    add(out, { key: `${prefix}.points`, label: `Promotion points: ${p.summary}`, value: show(p.points), quote: q, checkField });
    add(out, { key: `${prefix}.categories`, label: `Promotion categories: ${p.summary}`, value: showList(p.categories), quote: q, checkField });
    add(out, { key: `${prefix}.valid_from`, label: `Promotion starts: ${p.summary}`, value: show(p.valid_from), quote: q, checkField });
    add(out, { key: `${prefix}.valid_to`, label: `Promotion ends: ${p.summary}`, value: show(p.valid_to), quote: q, checkField });
    add(out, { key: `${prefix}.source_url`, label: `Promotion URL: ${p.summary}`, value: show(p.source_url), quote: q, checkField });
  });
}

/** Field rows for the review card: changed fields first, vs the catalog value they replace. */
export function buildFieldRows(finding: Pick<PendingFinding, "extracted" | "check_results" | "diff">): FieldRow[] {
  const checks = new Map((finding.check_results?.fields ?? []).map((f) => [f.field, f]));
  const x = finding.extracted;
  if (!x) return [];
  const candidates = candidatesFor(x);
  const changes: FieldChange[] = finding.diff?.changes ?? [];
  const changedKeys = new Set(changes.map((c) => c.field));

  const rows: FieldRow[] = changes.map((c) => {
    // A category the page doesn't list earns its "other" rate (same rule as the crawler's diff).
    const cand =
      candidates.get(c.field) ?? (c.field.startsWith("earn_rate.") ? candidates.get("earn_rate.other") : undefined);
    return {
      key: c.field,
      label: cand?.label ?? c.field,
      current: show(c.catalog),
      proposed: show(c.extracted),
      quote: cand?.quote ?? null,
      check: cand?.checkField ? (checks.get(cand.checkField) ?? null) : null,
      changed: true,
    };
  });

  const isNew = finding.diff?.kind === "new";
  for (const [key, cand] of candidates) {
    if (changedKeys.has(key)) continue;
    // Prefer the exact check field; fall back to the earn-rate / welcome parent when sub-checks are absent.
    const check =
      (cand.checkField ? checks.get(cand.checkField) : null) ??
      (cand.checkField?.includes(".")
        ? checks.get(cand.checkField.replace(/\.[^.]+$/, ""))
        : null) ??
      null;
    rows.push({
      key,
      label: cand.label,
      current: null,
      proposed: cand.value,
      quote: cand.quote,
      check,
      changed: isNew,
    });
  }
  return rows;
}

/** Needs a look: warnings (failed checks) and catalog changes; else Looks right. */
export function splitFieldRows(rows: FieldRow[]): { needsLook: FieldRow[]; looksRight: FieldRow[] } {
  const needsLook: FieldRow[] = [];
  const looksRight: FieldRow[] = [];
  for (const row of rows) {
    if (row.changed || (row.check && !row.check.ok)) needsLook.push(row);
    else looksRight.push(row);
  }
  return { needsLook, looksRight };
}

/** Fields that differ from the catalog; for a new card, every extracted field. */
export function changedFieldCount(finding: Pick<PendingFinding, "extracted" | "check_results" | "diff">): number {
  if (finding.diff?.kind === "new") return buildFieldRows(finding).length;
  return finding.diff?.changes.length ?? 0;
}

export function failedChecks(finding: Pick<PendingFinding, "check_results">): FieldCheck[] {
  return (finding.check_results?.fields ?? []).filter((f) => !f.ok);
}

export function failedCheckCount(finding: Pick<PendingFinding, "check_results" | "flagged_count">): number {
  const failed = failedChecks(finding).length;
  return failed > 0 ? failed : finding.flagged_count;
}
