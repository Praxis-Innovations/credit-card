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

function assignIf<T>(row: RewardCategory, key: keyof RewardCategory, value: T | null | undefined, when: boolean): void {
  if (when && value != null) (row as Record<string, unknown>)[key as string] = value;
}

function copyExtractionExtras(row: RewardCategory, e: ExtractedEarnRate): void {
  assignIf(row, "mccs", e.mccs ? [...e.mccs] : undefined, Boolean(e.mccs?.length));
  assignIf(row, "merchants", e.merchants ? [...e.merchants] : undefined, Boolean(e.merchants?.length));
  assignIf(row, "mccSource", e.mcc_source, Boolean(e.mcc_source));
  assignIf(row, "exclusions", e.exclusions ? [...e.exclusions] : undefined, Boolean(e.exclusions?.length));
  assignIf(row, "capGroup", e.cap_group, Boolean(e.cap_group));
  assignIf(row, "rateAfterCap", e.rate_after_cap, e.rate_after_cap != null);
  assignIf(row, "tierThreshold", e.tier_threshold, e.tier_threshold != null);
  assignIf(row, "validFrom", e.valid_from, Boolean(e.valid_from));
  assignIf(row, "validTo", e.valid_to, Boolean(e.valid_to));
  assignIf(row, "quote", e.quote, Boolean(e.quote));
  assignIf(row, "sourceUrl", e.source_url, Boolean(e.source_url));
  if (e.cap_amount == null) return;
  if (e.cap_period === "annual") row.capAnnual = e.cap_amount;
  else row.capMonthly = e.cap_amount;
}

function fromExtraction(e: ExtractedEarnRate): RewardCategory {
  const row: RewardCategory = { category: e.category, earnRate: e.rate };
  copyExtractionExtras(row, e);
  return row;
}

function collectIndices(decisions: Map<string, FieldDecision>, extracted: ExtractedEarnRate[]): number[] {
  const indices = new Set<number>();
  for (const key of decisions.keys()) {
    const m = key.match(INDEXED_EARN);
    if (m) indices.add(Number(m[1]));
  }
  if (indices.size > 0) extracted.forEach((_, i) => indices.add(i));
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

function buildIndexedRow(
  ext: ExtractedEarnRate,
  i: number,
  decisions: Map<string, FieldDecision>,
  overrides: Map<string, number>,
  maxByCategory: Map<string, number>,
): Result<RewardCategory> {
  const row = fromExtraction(ext);
  const override = overrides.get(ext.category);
  if (override != null && ext.rate === maxByCategory.get(ext.category)) {
    row.earnRate = override;
  }
  for (const [key, d] of decisions) {
    const m = key.match(INDEXED_EARN);
    if (!m || Number(m[1]) !== i) continue;
    const err = applyIndexedField(row, m[2]!, d.value);
    if (err) return err;
  }
  finalizeCap(row);
  return { ok: true, value: row };
}

/**
 * Builds catalog `reward_categories` from approve decisions.
 * Indexed `earn_rates[i].*` fields rebuild from extraction (multiple rates per category);
 * plain `earn_rate.<category>` still updates the highest rate for that category.
 */
export function applyEarnRates(
  base: RewardCategory[],
  decisions: Map<string, FieldDecision>,
  extracted: ExtractedEarnRate[] | undefined,
): Result<RewardCategory[]> {
  const overrides = rateOverrides(decisions);
  if (!overrides.ok) return overrides;

  const indices = collectIndices(decisions, extracted ?? []);
  if (indices.length === 0) {
    if (overrides.value.size === 0) return { ok: true, value: base };
    return { ok: true, value: applyRatesByCategory(base, overrides.value) };
  }

  if (!extracted?.length) {
    return { ok: false, message: "Card-rule fields need the original extraction. Refresh and try again." };
  }

  const maxByCategory = new Map<string, number>();
  for (const e of extracted) {
    maxByCategory.set(e.category, Math.max(maxByCategory.get(e.category) ?? 0, e.rate));
  }

  const categories: RewardCategory[] = [];
  for (const i of indices) {
    const ext = extracted[i];
    if (!ext) return { ok: false, message: `Missing extraction for earn rate #${i + 1}.` };
    const built = buildIndexedRow(ext, i, decisions, overrides.value, maxByCategory);
    if (!built.ok) return built;
    categories.push(built.value);
  }
  if (categories.length === 0) categories.push({ category: "other", earnRate: 1 });
  return { ok: true, value: categories };
}

export function hasEarnRuleDecisions(decisions: Map<string, FieldDecision>): boolean {
  return [...decisions.keys()].some(
    (k) => k.startsWith("earn_rate.") || k.startsWith("earn_rates[") || k.startsWith("promotion."),
  );
}
