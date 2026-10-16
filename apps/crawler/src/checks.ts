import type { CardExtraction, EarnUnit, NumberField } from "./extract/schema";
import { NUMBER_FIELDS } from "./extract/schema";

export interface FieldCheck {
  field: string;
  quote_found: boolean;
  /** null when the value is a label we do not expect verbatim in the quote. */
  value_in_quote: boolean | null;
  /** null when no range applies. */
  in_range: boolean | null;
  ok: boolean;
  issues: string[];
}

export interface CheckResult {
  ok: boolean;
  total: number;
  flagged: number;
  fields: FieldCheck[];
}

export const RANGES: Record<NumberField, [number, number]> = {
  annual_fee: [0, 1000],
  additional_card_fee: [0, 1000],
  purchase_apr: [0, 40],
  cash_advance_apr: [0, 40],
  balance_transfer_apr: [0, 40],
  fx_fee_percent: [0, 10],
  min_personal_income: [0, 1_000_000],
  min_household_income: [0, 1_000_000],
  min_credit_limit: [0, 100_000],
};

export const EARN_RANGES: Record<EarnUnit, [number, number]> = {
  points_per_dollar: [0, 20],
  miles_per_dollar: [0, 20],
  percent_cashback: [0, 15],
};

const BONUS_POINTS_RANGE: [number, number] = [0, 300_000];
const BONUS_CASH_RANGE: [number, number] = [0, 2_000];

/**
 * Normalisation shared by page text and quotes: Unicode compatibility forms,
 * typographic quotes/dashes, trademark and footnote marks, table/list markers
 * our cleaner adds, and whitespace. Case is preserved — quotes must be verbatim.
 */
export function normaliseForMatch(s: string): string {
  return s
    .replace(/[®™©℠*†‡§¹²³⁴⁵⁶⁷⁸⁹⁰]/g, "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'")
    .replace(/[\u201c\u201d\u201e\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/(^|\n)- /g, "$1")
    .replace(/\s\|\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteInText(quote: string, normalisedPage: string): boolean {
  const q = normaliseForMatch(quote).replace(/[.,;:]$/, "");
  return q.length > 0 && normalisedPage.includes(q);
}

/** Numbers written in a quote: "$1,200", "20.99%", "60K", "$0". */
export function numbersIn(quote: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*([kK]\b)?/g;
  for (const m of normaliseForMatch(quote).matchAll(re)) {
    const n = Number(m[1]!.replace(/,/g, "") + (m[2] ?? ""));
    out.push(m[3] ? n * 1000 : n);
  }
  return out;
}

export function numberInQuote(value: number, quote: string): boolean {
  if (numbersIn(quote).some((n) => Math.abs(n - value) < 1e-6)) return true;
  return value === 0 && /\b(no|zero|free|none|waived|nil)\b/i.test(quote);
}

const loose = (s: string) => normaliseForMatch(s).toLowerCase().replace(/[^a-z0-9+]/g, "");

const STRING_ALIASES: Record<string, string[]> = {
  americanexpress: ["amex"],
  mastercard: ["mastercard"],
  cashback: ["cashback", "cashbackrewards"],
};

/**
 * Catalog issuer name → legal / trade names that count as the same issuer in a
 * quote. Big-six Canadian banks; keyed by the loose form of the catalog name.
 */
export const ISSUER_ALIASES: Record<string, readonly string[]> = {
  scotiabank: ["bankofnovascotia", "thebankofnovascotia", "scotia"],
  rbc: ["royalbankofcanada", "royalbank"],
  td: ["torontodominionbank", "thetorontodominionbank", "tdbank"],
  bmo: ["bankofmontreal"],
  cibc: ["canadianimperialbankofcommerce"],
  nationalbank: ["nationalbankofcanada"],
};

export interface CheckOptions {
  /** When false, skip issuer aliases (CR6 before/after comparison). Default true. */
  issuerAliases?: boolean;
}

export function stringInQuote(value: string, quote: string, opts?: { issuerAliases?: boolean }): boolean {
  const v = loose(value);
  const q = loose(quote);
  if (!v) return false;
  if (q.includes(v) || (STRING_ALIASES[v] ?? []).some((alias) => q.includes(alias))) return true;
  if (opts?.issuerAliases === false) return false;
  return (ISSUER_ALIASES[v] ?? []).some((alias) => q.includes(alias));
}

function inRange(n: number, [lo, hi]: [number, number]): boolean {
  return n >= lo && n <= hi;
}

function finish(c: Omit<FieldCheck, "ok">): FieldCheck {
  return { ...c, ok: c.issues.length === 0 };
}

function checkQuoted(
  field: string,
  q: { quote: string },
  page: string,
  valueCheck: boolean | null,
  range: boolean | null,
): FieldCheck {
  const quote_found = quoteInText(q.quote, page);
  const issues: string[] = [];
  if (!quote_found) issues.push("quote not found verbatim in page text");
  if (valueCheck === false) issues.push("value does not appear in its quote");
  if (range === false) issues.push("value outside plausible range");
  return finish({ field, quote_found, value_in_quote: valueCheck, in_range: range, issues });
}

/** Runs every deterministic check. Failed values are flagged here, never removed from the extraction. */
export function checkExtraction(
  extraction: CardExtraction,
  pageText: string,
  opts: CheckOptions = {},
): CheckResult {
  const page = normaliseForMatch(pageText);
  const fields: FieldCheck[] = [];
  const aliasOpts = { issuerAliases: opts.issuerAliases };

  if (!extraction.card_name) {
    fields.push(
      finish({ field: "card_name", quote_found: false, value_in_quote: null, in_range: null, issues: ["card name missing"] }),
    );
  }
  for (const f of ["card_name", "issuer", "network", "reward_currency"] as const) {
    const q = extraction[f];
    if (q) {
      const inQuote =
        f === "issuer" ? stringInQuote(q.value, q.quote, aliasOpts) : stringInQuote(q.value, q.quote, { issuerAliases: false });
      fields.push(checkQuoted(f, q, page, inQuote, null));
    }
  }
  for (const f of NUMBER_FIELDS) {
    const q = extraction[f];
    if (q) fields.push(checkQuoted(f, q, page, numberInQuote(q.value, q.quote), inRange(q.value, RANGES[f])));
  }
  extraction.earn_rates.forEach((e, i) => {
    fields.push(
      checkQuoted(
        `earn_rates[${i}] ${e.category}`,
        e,
        page,
        numberInQuote(e.rate, e.quote),
        e.rate > 0 && inRange(e.rate, EARN_RANGES[e.unit]),
      ),
    );
  });
  const wb = extraction.welcome_bonus;
  if (wb) {
    const nums = [wb.value.points, wb.value.cashback_cad].filter((n): n is number => n !== null);
    const valueOk = nums.length ? nums.every((n) => numberInQuote(n, wb.quote)) : null;
    const rangeOk =
      nums.length === 0
        ? null
        : (wb.value.points === null || inRange(wb.value.points, BONUS_POINTS_RANGE)) &&
          (wb.value.cashback_cad === null || inRange(wb.value.cashback_cad, BONUS_CASH_RANGE));
    fields.push(checkQuoted("welcome_bonus", wb, page, valueOk, rangeOk));
  }
  extraction.insurance_highlights.forEach((h, i) => {
    fields.push(checkQuoted(`insurance_highlights[${i}]`, h, page, null, null));
  });

  const flagged = fields.filter((f) => !f.ok).length;
  return { ok: flagged === 0, total: fields.length, flagged, fields };
}
