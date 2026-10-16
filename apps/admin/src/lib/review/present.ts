import type { PillTone } from "@/lib/sources/present";
import type { DiffKind, Extraction, FieldCheck, FieldChange, PendingFinding } from "./types";

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

function show(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "none" : String(value);
}

type Candidate = { label: string; value: string; quote: string | null; checkField: string | null };

function candidatesFor(x: Extraction): Map<string, Candidate> {
  const out = new Map<string, Candidate>();
  if (x.card_name) out.set("name", { label: "Card name", value: x.card_name.value, quote: x.card_name.quote, checkField: "card_name" });
  if (x.network) out.set("network", { label: "Network", value: x.network.value, quote: x.network.quote, checkField: "network" });
  if (x.annual_fee) {
    out.set("annual_fee", { label: "Annual fee ($)", value: String(x.annual_fee.value), quote: x.annual_fee.quote, checkField: "annual_fee" });
  }
  if (x.welcome_bonus) {
    out.set("welcome_bonus.points", {
      label: "Welcome bonus (points)",
      value: show(x.welcome_bonus.value.points),
      quote: x.welcome_bonus.quote,
      checkField: "welcome_bonus",
    });
  }
  (x.earn_rates ?? []).forEach((e, i) => {
    const key = `earn_rate.${e.category}`;
    const prev = out.get(key);
    // The diff uses the highest stated rate per category.
    if (!prev || e.rate > Number(prev.value)) {
      out.set(key, {
        label: `Earn rate: ${e.category.replace(/_/g, " ")}`,
        value: String(e.rate),
        quote: e.quote,
        checkField: `earn_rates[${i}] ${e.category}`,
      });
    }
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
    rows.push({
      key,
      label: cand.label,
      current: null,
      proposed: cand.value,
      quote: cand.quote,
      check: cand.checkField ? (checks.get(cand.checkField) ?? null) : null,
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
