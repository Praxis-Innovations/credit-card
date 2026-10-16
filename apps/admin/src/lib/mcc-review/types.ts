/** Wire shapes for public.merchant_code_findings and related brand rows. */

export const STORE_CODE_KINDS = ["store_code", "test_purchase"] as const;

export type CatalogStatus = "pending" | "verified" | "stale" | "rejected" | "conflict";

export type MccCertainty =
  | "confirmed"
  | "varies_by_store"
  | "varies_by_network"
  | "varies_by_product"
  | "category_only"
  | "estimate"
  | "unknown";

export type MerchantCodeFinding = {
  id: string;
  kind: "store_code" | "test_purchase" | "mcc_code" | "category_mcc" | "store_type_mcc";
  idempotency_key: string;
  proposed: Record<string, unknown>;
  review_status: "pending" | "approved" | "rejected" | "ignored";
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type BrandSnapshot = {
  id: string;
  name: string;
  mcc: string | null;
  amex_mcc: string | null;
  certainty: MccCertainty | string;
  status: CatalogStatus;
};

export const FINDING_COLUMNS =
  "id, kind, idempotency_key, proposed, review_status, review_note, reviewed_by, reviewed_at, created_at";

export const BRAND_COLUMNS = "id, name, mcc, amex_mcc, certainty, status";

export const MAX_REVIEW_NOTE = 1000;
export const MCC_REVIEW_PAGE_SIZE = 500;
