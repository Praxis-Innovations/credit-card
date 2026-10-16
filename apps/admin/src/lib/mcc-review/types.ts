/** Wire shapes for public.merchant_code_findings and related brand rows. */

export const STORE_CODE_KINDS = ["store_code", "test_purchase"] as const;
export type StoreCodeKind = (typeof STORE_CODE_KINDS)[number];

export type MerchantCodeFindingKind =
  | StoreCodeKind
  | "mcc_code"
  | "category_mcc"
  | "store_type_mcc";

export type MerchantCodeReviewStatus = "pending" | "approved" | "rejected" | "ignored";

export type CatalogStatus = "pending" | "verified" | "stale" | "rejected" | "conflict";

export type MccCertainty =
  | "confirmed"
  | "varies_by_store"
  | "varies_by_network"
  | "varies_by_product"
  | "category_only"
  | "estimate"
  | "unknown";

export type StoreCodeProposed = {
  chain: string;
  wikidata_id?: string | null;
  mcc: string;
  network: string;
  channel: string;
  certainty: MccCertainty | string;
  source_type: string;
  url: string;
  observed_date: string;
  quote: string;
};

export type TestPurchaseProposed = {
  date: string;
  card?: string;
  card_id?: string;
  network?: string;
  statement_text: string;
  mcc_shown?: string | null;
  category_shown?: string | null;
  screenshot_file?: string | null;
  chain?: string | null;
  store_number?: string | null;
  city?: string | null;
  location?: string | null;
  format?: string | null;
  source_type?: string;
};

export type MerchantCodeFinding = {
  id: string;
  kind: MerchantCodeFindingKind;
  idempotency_key: string;
  proposed: Record<string, unknown>;
  review_status: MerchantCodeReviewStatus;
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

export type EvidenceRow = {
  id: string;
  chain: string;
  mcc: string | null;
  network: string;
  source_type: string;
  url: string | null;
  quote: string | null;
  observed_date: string | null;
  statement_text: string | null;
};

export const FINDING_COLUMNS =
  "id, kind, idempotency_key, proposed, review_status, review_note, reviewed_by, reviewed_at, created_at";

export const BRAND_COLUMNS = "id, name, mcc, amex_mcc, certainty, status";

export const MAX_REVIEW_NOTE = 1000;
export const MCC_REVIEW_PAGE_SIZE = 500;
