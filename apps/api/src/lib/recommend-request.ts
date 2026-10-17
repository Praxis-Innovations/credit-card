import {
  CATEGORIES,
  POINT_CURRENCIES,
  type Category,
  type FuelGrade,
  type PointCurrency,
  type SpendToDate,
} from "@/domain";
import { ApiError } from "./errors";
import { isCategory, isFuelGrade, isMccCode } from "./recommend";

/** Cap category-keyed maps at the known category count. */
const MAX_CATEGORY_MAP_KEYS = CATEGORIES.length;
/** Cap free-string maps (cap groups, card ids) to limit abuse. */
const MAX_ID_MAP_KEYS = 64;
/** Sanity ceiling for cents CAD per point overrides (defaults peak ~2.4). */
const MAX_VALUATION_CENTS = 100;

const CATEGORY_SET = new Set<string>(CATEGORIES);
const CURRENCY_SET = new Set<string>(POINT_CURRENCIES);

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "bad_request", "Request body must be JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "bad_request", "Request body must be an object");
  }
  return body as Record<string, unknown>;
}

export function assertValidMccField(raw: Record<string, unknown>): void {
  if (raw.mcc !== undefined && raw.mcc !== null && !isMccCode(raw.mcc)) {
    throw new ApiError(400, "bad_request", "mcc must be a 4-digit code");
  }
}

export interface SharedStoreFields {
  mcc?: string;
  merchant?: string;
  merchantQuery?: string;
  osmTag?: string;
  categoryFallback?: Category;
  fuelGrade?: FuelGrade;
  spendToDate?: SpendToDate;
  valuations?: Partial<Record<PointCurrency, number>>;
}

function assertPlainObject(
  value: unknown,
  field: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "bad_request", `${field} must be an object`);
  }
}

function parseFiniteNumber(
  value: unknown,
  field: string,
  opts: { min?: number; exclusiveMin?: number; max?: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(
      400,
      "bad_request",
      `${field} must be a finite number`,
    );
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new ApiError(400, "bad_request", `${field} must be >= ${opts.min}`);
  }
  if (opts.exclusiveMin !== undefined && !(value > opts.exclusiveMin)) {
    throw new ApiError(
      400,
      "bad_request",
      `${field} must be greater than ${opts.exclusiveMin}`,
    );
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new ApiError(400, "bad_request", `${field} must be <= ${opts.max}`);
  }
  return value;
}

function parseCategorySpendMap(
  raw: unknown,
  field: string,
): Partial<Record<Category, number>> {
  assertPlainObject(raw, field);
  const keys = Object.keys(raw);
  if (keys.length > MAX_CATEGORY_MAP_KEYS) {
    throw new ApiError(
      400,
      "bad_request",
      `${field} has too many keys (max ${MAX_CATEGORY_MAP_KEYS})`,
    );
  }
  const out: Partial<Record<Category, number>> = {};
  for (const key of keys) {
    if (!CATEGORY_SET.has(key)) {
      throw new ApiError(
        400,
        "bad_request",
        `${field} has unknown category key: ${key}`,
      );
    }
    out[key as Category] = parseFiniteNumber(raw[key], `${field}.${key}`, {
      min: 0,
    });
  }
  return out;
}

/** Validate spendToDate: known categories only, finite non-negative amounts. */
export function parseSpendToDate(raw: unknown): SpendToDate | undefined {
  if (raw === undefined || raw === null) return undefined;
  assertPlainObject(raw, "spendToDate");
  for (const key of Object.keys(raw)) {
    if (key !== "monthly" && key !== "annual") {
      throw new ApiError(
        400,
        "bad_request",
        `spendToDate has unknown key: ${key}`,
      );
    }
  }
  const result: SpendToDate = {};
  if (raw.monthly !== undefined && raw.monthly !== null) {
    result.monthly = parseCategorySpendMap(raw.monthly, "spendToDate.monthly");
  }
  if (raw.annual !== undefined && raw.annual !== null) {
    result.annual = parseCategorySpendMap(raw.annual, "spendToDate.annual");
  }
  return result;
}

/** Validate valuations: known currencies only, finite (0, MAX] cents/point. */
export function parseValuations(
  raw: unknown,
): Partial<Record<PointCurrency, number>> | undefined {
  if (raw === undefined || raw === null) return undefined;
  assertPlainObject(raw, "valuations");
  const keys = Object.keys(raw);
  if (keys.length > POINT_CURRENCIES.length) {
    throw new ApiError(
      400,
      "bad_request",
      `valuations has too many keys (max ${POINT_CURRENCIES.length})`,
    );
  }
  const out: Partial<Record<PointCurrency, number>> = {};
  for (const key of keys) {
    if (!CURRENCY_SET.has(key)) {
      throw new ApiError(
        400,
        "bad_request",
        `valuations has unknown currency: ${key}`,
      );
    }
    out[key as PointCurrency] = parseFiniteNumber(raw[key], `valuations.${key}`, {
      exclusiveMin: 0,
      max: MAX_VALUATION_CENTS,
    });
  }
  return out;
}

/**
 * Validate a string→number map (cap groups / annual spend by card).
 * Keys must be non-empty strings; values finite and >= 0.
 */
export function parseNonNegativeIdMap(
  raw: unknown,
  field: string,
): Record<string, number> | undefined {
  if (raw === undefined || raw === null) return undefined;
  assertPlainObject(raw, field);
  const keys = Object.keys(raw);
  if (keys.length > MAX_ID_MAP_KEYS) {
    throw new ApiError(
      400,
      "bad_request",
      `${field} has too many keys (max ${MAX_ID_MAP_KEYS})`,
    );
  }
  const out: Record<string, number> = {};
  for (const key of keys) {
    if (!key || typeof key !== "string") {
      throw new ApiError(400, "bad_request", `${field} keys must be non-empty strings`);
    }
    out[key] = parseFiniteNumber(raw[key], `${field}.${key}`, { min: 0 });
  }
  return out;
}

export function mapSharedStoreFields(raw: Record<string, unknown>): SharedStoreFields {
  return {
    mcc: typeof raw.mcc === "string" ? raw.mcc : undefined,
    merchant: typeof raw.merchant === "string" ? raw.merchant : undefined,
    merchantQuery:
      typeof raw.merchantQuery === "string" ? raw.merchantQuery : undefined,
    osmTag: typeof raw.osmTag === "string" ? raw.osmTag : undefined,
    categoryFallback: isCategory(raw.categoryFallback)
      ? raw.categoryFallback
      : undefined,
    fuelGrade:
      raw.fuelGrade === undefined || raw.fuelGrade === null
        ? undefined
        : isFuelGrade(raw.fuelGrade)
          ? raw.fuelGrade
          : undefined,
    spendToDate: parseSpendToDate(raw.spendToDate),
    valuations: parseValuations(raw.valuations),
  };
}
