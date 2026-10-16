import {
  isEmpty,
  parseCapPeriod,
  parseIsoDate,
  parseMccList,
  parseMccSource,
  parseNonNegNumber,
  parseStringList,
  type ParseResult,
} from "./catalog-write-parse";
import type { ExtractedEarnRate, FieldDecision } from "./types";

export type RewardCategory = {
  category: string;
  earnRate: number;
  capMonthly?: number;
  capAnnual?: number;
  mccs?: string[];
  merchants?: string[];
  mccSource?: "terms" | "network_default";
  exclusions?: string[];
  capGroup?: string;
  rateAfterCap?: number;
  tierThreshold?: number;
  validFrom?: string;
  validTo?: string;
  quote?: string;
  sourceUrl?: string;
};

export type WelcomeOffer = {
  summary: string;
  estimatedValueCad?: number;
  points?: number;
  rate?: number;
  validFrom?: string;
  validTo?: string;
  newCardholdersOnly?: boolean;
};

const INDEXED_EARN = /^earn_rates\[(\d+)\]\.(.+)$/;

type Err = { ok: false; message: string };
type Result<T> = ParseResult<T>;
type CapScratch = RewardCategory & { _capAmount?: number; _capPeriod?: string };
type FieldHandler = (row: RewardCategory, raw: string) => Err | null;

function setOptionalDate(target: RewardCategory, key: "validFrom" | "validTo", raw: string): Err | null {
  if (isEmpty(raw)) {
    delete target[key];
    return null;
  }
  const date = parseIsoDate(raw);
  if (!date) {
    return { ok: false, message: `Enter ${key === "validFrom" ? "start" : "end"} date as YYYY-MM-DD.` };
  }
  target[key] = date;
  return null;
}

function setListField(row: RewardCategory, key: "merchants" | "exclusions", raw: string): void {
  const list = parseStringList(raw);
  if (list) row[key] = list;
  else delete row[key];
}

function setOptionalNumber(
  row: RewardCategory,
  key: "rateAfterCap" | "tierThreshold",
  raw: string,
  label: string,
): Err | null {
  const n = parseNonNegNumber(raw, false);
  if (n === null && !isEmpty(raw)) return { ok: false, message: `Enter a valid ${label}.` };
  if (n === null) delete row[key];
  else row[key] = n;
  return null;
}

function setMccs(row: RewardCategory, raw: string): Err | null {
  const parsed = parseMccList(raw);
  if (!parsed.ok) return parsed;
  if (parsed.value) row.mccs = parsed.value;
  else delete row.mccs;
  return null;
}

function setMccSource(row: RewardCategory, raw: string): Err | null {
  const parsed = parseMccSource(raw);
  if (!parsed.ok) return parsed;
  if (parsed.value) row.mccSource = parsed.value;
  else delete row.mccSource;
  return null;
}

function setCapAmount(row: RewardCategory, raw: string): Err | null {
  const amount = parseNonNegNumber(raw, false);
  if (amount === null && !isEmpty(raw)) return { ok: false, message: "Enter a valid cap amount." };
  delete row.capMonthly;
  delete row.capAnnual;
  (row as CapScratch)._capAmount = amount ?? undefined;
  return null;
}

function setCapPeriod(row: RewardCategory, raw: string): Err | null {
  const parsed = parseCapPeriod(raw);
  if (!parsed.ok) return parsed;
  if (parsed.value) (row as CapScratch)._capPeriod = parsed.value;
  return null;
}

function setCapGroup(row: RewardCategory, raw: string): Err | null {
  if (isEmpty(raw)) delete row.capGroup;
  else row.capGroup = raw.trim();
  return null;
}

function setSourceUrl(row: RewardCategory, raw: string): Err | null {
  if (isEmpty(raw)) delete row.sourceUrl;
  else row.sourceUrl = raw.trim();
  return null;
}

const INDEXED_HANDLERS: Record<string, FieldHandler> = {
  mccs: setMccs,
  merchants: (row, raw) => {
    setListField(row, "merchants", raw);
    return null;
  },
  mcc_source: setMccSource,
  exclusions: (row, raw) => {
    setListField(row, "exclusions", raw);
    return null;
  },
  cap_amount: setCapAmount,
  cap_period: setCapPeriod,
  cap_group: setCapGroup,
  rate_after_cap: (row, raw) => setOptionalNumber(row, "rateAfterCap", raw, "rate after cap"),
  tier_threshold: (row, raw) => setOptionalNumber(row, "tierThreshold", raw, "spend tier threshold"),
  valid_from: (row, raw) => setOptionalDate(row, "validFrom", raw),
  valid_to: (row, raw) => setOptionalDate(row, "validTo", raw),
  source_url: setSourceUrl,
};

function applyIndexedField(row: RewardCategory, field: string, raw: string): Err | null {
  const handler = INDEXED_HANDLERS[field];
  if (!handler) return { ok: false, message: `Unknown earn-rate field ${field}.` };
  return handler(row, raw);
}

function finalizeCap(row: RewardCategory): void {
  const ext = row as CapScratch;
  const amount = ext._capAmount;
  const period = ext._capPeriod;
  delete ext._capAmount;
  delete ext._capPeriod;
  if (amount == null) return;
  if (period === "annual") {
    row.capAnnual = amount;
    delete row.capMonthly;
  } else {
    row.capMonthly = amount;
    delete row.capAnnual;
  }
}

/** Indices that appear in saved `earn_rates[i].*` decisions only (not every extraction row). */
function collectTouchedIndices(decisions: Map<string, FieldDecision>): number[] {
  const indices = new Set<number>();
  for (const key of decisions.keys()) {
    const m = key.match(INDEXED_EARN);
    if (m) indices.add(Number(m[1]));
  }
  return [...indices].sort((a, b) => a - b);
}

function rateOverrides(decisions: Map<string, FieldDecision>): Result<Map<string, number>> {
  const out = new Map<string, number>();
  for (const [key, d] of decisions) {
    if (!key.startsWith("earn_rate.")) continue;
    const category = key.slice("earn_rate.".length);
    if (!category) return { ok: false, message: `Invalid earn-rate field ${key}.` };
    const rate = parseNonNegNumber(d.value, false);
    if (rate === null) return { ok: false, message: `Enter a valid earn rate for ${category}.` };
    out.set(category, rate);
  }
  return { ok: true, value: out };
}

/** Legacy path: merge highest rate per category onto the existing catalog list. */
function applyRatesByCategory(base: RewardCategory[], overrides: Map<string, number>): RewardCategory[] {
  const byCat = new Map(base.map((r) => [r.category, { ...r }]));
  for (const [category, rate] of overrides) {
    const prev = byCat.get(category);
    byCat.set(category, prev ? { ...prev, earnRate: rate } : { category, earnRate: rate });
  }
  const categories = [...byCat.values()];
  if (categories.length === 0) categories.push({ category: "other", earnRate: 1 });
  return categories;
}

function rowMatchesExtraction(row: RewardCategory, e: ExtractedEarnRate): boolean {
  if (row.category !== e.category) return false;
  if (e.cap_group && row.capGroup && row.capGroup !== e.cap_group) return false;
  if (e.tier_threshold != null && row.tierThreshold != null && row.tierThreshold !== e.tier_threshold) {
    return false;
  }
  return true;
}

/** Prefer category + cap group / tier; fall back to category alone among unclaimed rows. */
function findBaseIndex(rows: RewardCategory[], e: ExtractedEarnRate, claimed: Set<number>): number {
  let categoryOnly = -1;
  for (let i = 0; i < rows.length; i++) {
    if (claimed.has(i)) continue;
    const row = rows[i]!;
    if (!rowMatchesExtraction(row, e)) continue;
    const tight =
      (e.cap_group ? row.capGroup === e.cap_group : true) &&
      (e.tier_threshold != null ? row.tierThreshold === e.tier_threshold : true);
    if (tight) return i;
    if (categoryOnly < 0) categoryOnly = i;
  }
  return categoryOnly;
}

function applySavedIndexedFields(
  row: RewardCategory,
  index: number,
  decisions: Map<string, FieldDecision>,
): Err | null {
  for (const [key, d] of decisions) {
    const m = key.match(INDEXED_EARN);
    if (!m || Number(m[1]) !== index) continue;
    const err = applyIndexedField(row, m[2]!, d.value);
    if (err) return err;
  }
  finalizeCap(row);
  return null;
}

/** Highest extracted rate per category — `earn_rate.<cat>` maps to that row only. */
function maxRateByCategory(extracted: ExtractedEarnRate[]): Map<string, number> {
  const max = new Map<string, number>();
  for (const e of extracted) {
    const prev = max.get(e.category);
    if (prev === undefined || e.rate > prev) max.set(e.category, e.rate);
  }
  return max;
}

function rateForTouchedRow(
  ext: ExtractedEarnRate,
  overrides: Map<string, number>,
  categoryMax: Map<string, number>,
): number | undefined {
  const override = overrides.get(ext.category);
  if (override === undefined) return undefined;
  // Plain earn_rate.<cat> is the category max (see present.ts); lower tiers keep ext.rate.
  if (ext.rate === categoryMax.get(ext.category)) return override;
  return ext.rate;
}

function mergeTouchedIndex(args: {
  rows: RewardCategory[];
  claimed: Set<number>;
  index: number;
  ext: ExtractedEarnRate;
  decisions: Map<string, FieldDecision>;
  overrides: Map<string, number>;
  categoryMax: Map<string, number>;
  overrideApplied: Set<string>;
}): Err | null {
  const { rows, claimed, index, ext, decisions, overrides, categoryMax, overrideApplied } = args;
  const rate = rateForTouchedRow(ext, overrides, categoryMax);
  let idx = findBaseIndex(rows, ext, claimed);
  if (idx < 0) {
    rows.push({ category: ext.category, earnRate: rate ?? ext.rate });
    idx = rows.length - 1;
  }
  claimed.add(idx);
  const row = rows[idx]!;
  const err = applySavedIndexedFields(row, index, decisions);
  if (err) return err;
  if (rate !== undefined) {
    row.earnRate = rate;
    if (rate === overrides.get(ext.category)) overrideApplied.add(ext.category);
  }
  return null;
}

function applyRemainingRateOverrides(
  rows: RewardCategory[],
  claimed: Set<number>,
  overrides: Map<string, number>,
  overrideApplied: Set<string>,
): void {
  for (const [category, rate] of overrides) {
    if (overrideApplied.has(category)) continue;
    const unclaimed = rows.find((r, i) => r.category === category && !claimed.has(i));
    const hit = unclaimed ?? rows.find((r) => r.category === category);
    if (hit) hit.earnRate = rate;
    else rows.push({ category, earnRate: rate });
    overrideApplied.add(category);
  }
}

/**
 * Builds catalog `reward_categories` from approve decisions.
 * Indexed `earn_rates[i].*` updates merge onto matching existing rows (or add a
 * minimal new row); only saved keys are applied. Untouched base rows are kept.
 * Plain `earn_rate.<category>` still updates the rate for that category.
 */
export function applyEarnRates(
  base: RewardCategory[],
  decisions: Map<string, FieldDecision>,
  extracted: ExtractedEarnRate[] | undefined,
): Result<RewardCategory[]> {
  const overrides = rateOverrides(decisions);
  if (!overrides.ok) return overrides;

  const touched = collectTouchedIndices(decisions);
  if (touched.length === 0) {
    if (overrides.value.size === 0) return { ok: true, value: base };
    return { ok: true, value: applyRatesByCategory(base, overrides.value) };
  }

  if (!extracted?.length) {
    return { ok: false, message: "Card-rule fields need the original extraction. Refresh and try again." };
  }

  const rows = base.map((r) => ({ ...r }));
  const claimed = new Set<number>();
  const categoryMax = maxRateByCategory(extracted);
  const overrideApplied = new Set<string>();
  for (const i of touched) {
    const ext = extracted[i];
    if (!ext) return { ok: false, message: `Missing extraction for earn rate #${i + 1}.` };
    const err = mergeTouchedIndex({
      rows,
      claimed,
      index: i,
      ext,
      decisions,
      overrides: overrides.value,
      categoryMax,
      overrideApplied,
    });
    if (err) return err;
  }
  applyRemainingRateOverrides(rows, claimed, overrides.value, overrideApplied);
  if (rows.length === 0) rows.push({ category: "other", earnRate: 1 });
  return { ok: true, value: rows };
}

export function hasEarnRuleDecisions(decisions: Map<string, FieldDecision>): boolean {
  return [...decisions.keys()].some(
    (k) => k.startsWith("earn_rate.") || k.startsWith("earn_rates[") || k.startsWith("promotion."),
  );
}
