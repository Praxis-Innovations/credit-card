import {
  isEmpty,
  parseBool,
  parseIsoDate,
  parseNonNegNumber,
  parseStringList,
  type ParseResult,
} from "./catalog-write-parse";
import type { RewardCategory, WelcomeOffer } from "./catalog-write-rules";
import type { Extraction, FieldDecision } from "./types";

const PROMO = /^promotion\.(\d+)\.(.+)$/;

type Err = { ok: false; message: string };
type Result<T> = ParseResult<T>;
type PromoBase = NonNullable<Extraction["promotions"]>[number];

function applyWelcomeDates(
  offer: WelcomeOffer,
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
): Err | null {
  for (const [key, prop] of [
    ["welcome_bonus.valid_from", "validFrom"],
    ["welcome_bonus.valid_to", "validTo"],
  ] as const) {
    const d = decisions.get(key);
    if (!d) {
      if (current?.[prop]) offer[prop] = current[prop]!;
      continue;
    }
    if (isEmpty(d.value)) {
      delete offer[prop];
      continue;
    }
    const date = parseIsoDate(d.value);
    if (!date) {
      return {
        ok: false,
        message: `Enter welcome bonus ${prop === "validFrom" ? "start" : "end"} as YYYY-MM-DD.`,
      };
    }
    offer[prop] = date;
  }
  return null;
}

function rewriteSummaryForPoints(current: WelcomeOffer | null, points: number): string {
  if (!current?.summary) return `${points} points after qualifying spend`;
  const replaced = current.summary.replace(/(\d{1,3}(?:,\d{3})+|\d+)/, String(points));
  return replaced === current.summary ? `${points} points after qualifying spend` : replaced;
}

function applyWelcomeRate(
  offer: WelcomeOffer,
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
): Err | null {
  const rateDec = decisions.get("welcome_bonus.rate");
  if (!rateDec) {
    if (current?.rate != null) offer.rate = current.rate;
    return null;
  }
  const rate = parseNonNegNumber(rateDec.value, false);
  if (rate === null && !isEmpty(rateDec.value)) {
    return { ok: false, message: "Enter a valid welcome-bonus rate." };
  }
  if (rate === null) delete offer.rate;
  else offer.rate = rate;
  return null;
}

function applyNewCardholdersOnly(
  offer: WelcomeOffer,
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
): Err | null {
  const nco = decisions.get("welcome_bonus.new_cardholders_only");
  if (!nco) {
    if (current?.newCardholdersOnly != null) offer.newCardholdersOnly = current.newCardholdersOnly;
    return null;
  }
  const b = parseBool(nco.value);
  if (b === null && !isEmpty(nco.value)) {
    return { ok: false, message: "New cardholders only must be yes or no." };
  }
  if (b === null) delete offer.newCardholdersOnly;
  else offer.newCardholdersOnly = b;
  return null;
}

function resolveWelcomePoints(
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
  keys: string[],
): Result<number | null | undefined | "clear"> {
  const pointsDec = decisions.get("welcome_bonus.points");
  if (!pointsDec) return { ok: true, value: current?.points };
  const points = parseNonNegNumber(pointsDec.value, true);
  if (points === null && !isEmpty(pointsDec.value)) {
    return { ok: false, message: "Enter a valid welcome-bonus points value." };
  }
  if (points == null && isEmpty(pointsDec.value) && keys.length === 1) {
    return { ok: true, value: "clear" };
  }
  return { ok: true, value: points };
}

function baseWelcomeOffer(
  current: WelcomeOffer | null,
  points: number | null | undefined,
  pointsEdited: boolean,
): WelcomeOffer {
  const offer: WelcomeOffer = {
    summary: current?.summary ?? "",
    ...(current?.estimatedValueCad != null ? { estimatedValueCad: current.estimatedValueCad } : {}),
  };
  if (points != null) offer.points = points;
  if (pointsEdited && points != null) offer.summary = rewriteSummaryForPoints(current, points);
  else if (!offer.summary) offer.summary = current?.summary || "Welcome offer";
  return offer;
}

export function applyWelcomeOffer(
  current: WelcomeOffer | null,
  decisions: Map<string, FieldDecision>,
): Result<WelcomeOffer | null> {
  const keys = [...decisions.keys()].filter((k) => k.startsWith("welcome_bonus."));
  if (keys.length === 0) return { ok: true, value: current };

  const pointsRes = resolveWelcomePoints(current, decisions, keys);
  if (!pointsRes.ok) return pointsRes;
  if (pointsRes.value === "clear") return { ok: true, value: null };

  const offer = baseWelcomeOffer(
    current,
    pointsRes.value,
    decisions.has("welcome_bonus.points"),
  );
  const rateErr = applyWelcomeRate(offer, current, decisions);
  if (rateErr) return rateErr;
  const dateErr = applyWelcomeDates(offer, current, decisions);
  if (dateErr) return dateErr;
  const ncoErr = applyNewCardholdersOnly(offer, current, decisions);
  if (ncoErr) return ncoErr;

  return { ok: true, value: offer };
}

function promoDate(
  fields: Map<string, string>,
  key: "valid_from" | "valid_to",
  fallback: string | null | undefined,
  label: string,
): Result<string | undefined> {
  if (!fields.has(key)) return { ok: true, value: fallback ?? undefined };
  const raw = fields.get(key)!;
  if (isEmpty(raw)) return { ok: true, value: undefined };
  const d = parseIsoDate(raw);
  if (!d) return { ok: false, message: `Enter promotion ${label} as YYYY-MM-DD.` };
  return { ok: true, value: d };
}

function promoCategories(fields: Map<string, string>, base: PromoBase): string[] {
  const catsRaw = fields.get("categories");
  if (catsRaw === undefined) return base.categories.length ? base.categories : ["other"];
  return parseStringList(catsRaw) ?? ["other"];
}

function promoSourceUrl(fields: Map<string, string>, base: PromoBase): string | undefined {
  if (!fields.has("source_url")) return base.source_url ?? undefined;
  const raw = fields.get("source_url")!;
  return isEmpty(raw) ? undefined : raw.trim();
}

function buildPromoRows(fields: Map<string, string>, base: PromoBase): Result<RewardCategory[]> {
  const summary = fields.get("summary") ?? base.summary;
  if (isEmpty(summary)) return { ok: true, value: [] };

  const rateRaw = fields.get("rate");
  const rate = rateRaw !== undefined ? parseNonNegNumber(rateRaw, false) : base.rate;
  if (rateRaw !== undefined && rate === null && !isEmpty(rateRaw)) {
    return { ok: false, message: `Enter a valid rate for promotion "${summary}".` };
  }
  // Points-only promos are not earn rates — skip so we never write a 0x category row.
  if (rate == null) return { ok: true, value: [] };

  const from = promoDate(fields, "valid_from", base.valid_from, "start");
  if (!from.ok) return from;
  const to = promoDate(fields, "valid_to", base.valid_to, "end");
  if (!to.ok) return to;
  const sourceUrl = promoSourceUrl(fields, base);

  return {
    ok: true,
    value: promoCategories(fields, base).map((category) => {
      const row: RewardCategory = { category, earnRate: rate, quote: base.quote };
      if (from.value) row.validFrom = from.value;
      if (to.value) row.validTo = to.value;
      if (sourceUrl) row.sourceUrl = sourceUrl;
      return row;
    }),
  };
}

function promoIdentity(row: RewardCategory): string {
  return `${row.category}|${row.validFrom ?? ""}|${row.validTo ?? ""}|${row.quote ?? ""}`;
}

/** Replace earlier rows that match the same promo identity, then append the new ones. */
function mergePromoRows(categories: RewardCategory[], extra: RewardCategory[]): RewardCategory[] {
  if (extra.length === 0) return categories;
  const replacing = new Set(extra.map(promoIdentity));
  return [...categories.filter((r) => !replacing.has(promoIdentity(r))), ...extra];
}

/** Dated public promotions become extra reward_categories rows (with validFrom/validTo). */
export function applyPromotions(
  categories: RewardCategory[],
  decisions: Map<string, FieldDecision>,
  extracted: Extraction["promotions"] | undefined,
): Result<RewardCategory[]> {
  const promoKeys = [...decisions.keys()].filter((k) => k.startsWith("promotion."));
  if (promoKeys.length === 0) return { ok: true, value: categories };
  if (!extracted?.length) {
    return { ok: false, message: "Promotion fields need the original extraction. Refresh and try again." };
  }

  const byIndex = new Map<number, Map<string, string>>();
  for (const [key, d] of decisions) {
    const m = key.match(PROMO);
    if (!m) continue;
    const idx = Number(m[1]);
    const fields = byIndex.get(idx) ?? new Map();
    fields.set(m[2]!, d.value);
    byIndex.set(idx, fields);
  }

  const extra: RewardCategory[] = [];
  for (const [i, fields] of [...byIndex.entries()].sort((a, b) => a[0] - b[0])) {
    const base = extracted[i];
    if (!base) return { ok: false, message: `Missing extraction for promotion #${i + 1}.` };
    const rows = buildPromoRows(fields, base);
    if (!rows.ok) return rows;
    extra.push(...rows.value);
  }

  return { ok: true, value: mergePromoRows(categories, extra) };
}

export function hasWelcomeDecisions(decisions: Map<string, FieldDecision>): boolean {
  return [...decisions.keys()].some((k) => k.startsWith("welcome_bonus."));
}
