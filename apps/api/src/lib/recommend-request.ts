import type { Category, FuelGrade, PointCurrency, SpendToDate } from "@/domain";
import { ApiError } from "./errors";
import { isCategory, isFuelGrade, isMccCode } from "./recommend";

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
    spendToDate:
      raw.spendToDate && typeof raw.spendToDate === "object"
        ? (raw.spendToDate as SpendToDate)
        : undefined,
    valuations:
      raw.valuations && typeof raw.valuations === "object"
        ? (raw.valuations as Partial<Record<PointCurrency, number>>)
        : undefined,
  };
}
