const EMPTY = "none";
const MCC_SOURCES = new Set(["terms", "network_default"]);
const CAP_PERIODS = new Set(["monthly", "annual", "statement"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isEmpty(value: string): boolean {
  return value.trim() === "" || value.trim().toLowerCase() === EMPTY;
}

export function parseNonNegNumber(value: string, integer: boolean): number | null {
  if (isEmpty(value)) return null;
  const n = Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

/** Accepts YYYY-MM-DD only (review UI stores ISO dates). */
export function parseIsoDate(value: string): string | null {
  if (isEmpty(value)) return null;
  const s = value.trim();
  if (!ISO_DATE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function parseMccList(value: string): ParseResult<string[] | undefined> {
  if (isEmpty(value)) return { ok: true, value: undefined };
  const parts = value.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean);
  const mccs: string[] = [];
  for (const p of parts) {
    if (!/^\d{4}$/.test(p)) {
      return { ok: false, message: `MCC codes must be four digits (got ${p}).` };
    }
    mccs.push(p);
  }
  return { ok: true, value: [...new Set(mccs)] };
}

export function parseStringList(value: string): string[] | undefined {
  if (isEmpty(value)) return undefined;
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

export function parseBool(value: string): boolean | null {
  if (isEmpty(value)) return null;
  const s = value.trim().toLowerCase();
  if (s === "yes" || s === "true") return true;
  if (s === "no" || s === "false") return false;
  return null;
}

export function parseMccSource(raw: string): ParseResult<"terms" | "network_default" | undefined> {
  if (isEmpty(raw)) return { ok: true, value: undefined };
  if (!MCC_SOURCES.has(raw.trim())) {
    return { ok: false, message: "MCC source must be terms or network_default." };
  }
  return { ok: true, value: raw.trim() as "terms" | "network_default" };
}

export function parseCapPeriod(raw: string): ParseResult<string | undefined> {
  if (isEmpty(raw)) return { ok: true, value: undefined };
  if (!CAP_PERIODS.has(raw.trim())) {
    return { ok: false, message: "Cap period must be monthly, annual, or statement." };
  }
  return { ok: true, value: raw.trim() };
}
