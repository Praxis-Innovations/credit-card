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

function add(
  out: Map<string, Candidate>,
  key: string,
  label: string,
  value: string,
  quote: string | null,
  checkField: string | null,
) {
  // Skip empty optional rule fields so the queue stays focused.
  if (value === "none" && isOptionalRuleKey(key)) return;
  out.set(key, { label, value, quote, checkField });
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
    add(out, "welcome_bonus.points", "Welcome bonus (points)", show(wb.value.points), q, "welcome_bonus");
    add(out, "welcome_bonus.rate", "Welcome bonus (rate)", show(wb.value.rate), q, "welcome_bonus");
    add(out, "welcome_bonus.valid_from", "Welcome bonus starts", show(wb.value.valid_from), q, "welcome_bonus");
    add(out, "welcome_bonus.valid_to", "Welcome bonus ends", show(wb.value.valid_to), q, "welcome_bonus");
    add(
      out,
      "welcome_bonus.new_cardholders_only",
      "Welcome bonus: new cardholders only",
      show(wb.value.new_cardholders_only),
      q,
      "welcome_bonus",
    );
  }
  const rates = x.earn_rates ?? [];
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
    add(out, `${prefix}.mccs`, `${label}: MCCs`, showList(e.mccs), e.quote, `${check}.mccs`);
    add(out, `${prefix}.merchants`, `${label}: merchants`, showList(e.merchants), e.quote, `${check}.merchants`);
    add(out, `${prefix}.mcc_source`, `${label}: MCC source`, show(e.mcc_source), e.quote, `${check}.mcc_source`);
    add(out, `${prefix}.exclusions`, `${label}: exclusions`, showList(e.exclusions), e.quote, `${check}.exclusions`);
    add(out, `${prefix}.cap_amount`, `${label}: cap amount`, show(e.cap_amount), e.quote, `${check}.cap_amount`);
    add(out, `${prefix}.cap_period`, `${label}: cap period`, show(e.cap_period), e.quote, check);
    add(out, `${prefix}.cap_group`, `${label}: cap group`, show(e.cap_group), e.quote, check);
    add(out, `${prefix}.rate_after_cap`, `${label}: rate after cap`, show(e.rate_after_cap), e.quote, check);
    add(out, `${prefix}.tier_threshold`, `${label}: spend tier`, show(e.tier_threshold), e.quote, `${check}.tier_threshold`);
    add(out, `${prefix}.valid_from`, `${label}: starts`, show(e.valid_from), e.quote, check);
    add(out, `${prefix}.valid_to`, `${label}: ends`, show(e.valid_to), e.quote, check);
    add(out, `${prefix}.source_url`, `${label}: source URL`, show(e.source_url), e.quote, check);
  });
  (x.promotions ?? []).forEach((p, i) => {
    const check = `promotions[${i}]`;
    const prefix = `promotion.${i}`;
    add(out, `${prefix}.summary`, `Promotion: ${p.summary}`, p.summary, p.quote, check);
    add(out, `${prefix}.rate`, `Promotion rate: ${p.summary}`, show(p.rate), p.quote, check);
    add(out, `${prefix}.points`, `Promotion points: ${p.summary}`, show(p.points), p.quote, check);
    add(out, `${prefix}.categories`, `Promotion categories: ${p.summary}`, showList(p.categories), p.quote, check);
    add(out, `${prefix}.valid_from`, `Promotion starts: ${p.summary}`, show(p.valid_from), p.quote, check);
    add(out, `${prefix}.valid_to`, `Promotion ends: ${p.summary}`, show(p.valid_to), p.quote, check);
    add(out, `${prefix}.source_url`, `Promotion URL: ${p.summary}`, show(p.source_url), p.quote, check);
  });
  return out;
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
