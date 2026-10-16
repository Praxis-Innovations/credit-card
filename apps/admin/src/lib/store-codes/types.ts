/** Live merchant_brands + evidence shapes for the Store codes console (AD5). */

export type MccCertainty =
  | "confirmed"
  | "varies_by_store"
  | "varies_by_network"
  | "varies_by_product"
  | "category_only"
  | "estimate"
  | "unknown";

export type MerchantBrandRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  source_url: string;
  last_verified: string;
  status: "pending" | "verified" | "stale" | "rejected" | "conflict";
  mcc: string | null;
  amex_mcc: string | null;
  certainty: MccCertainty;
  reviewed_by: string | null;
};

export type EvidenceRow = {
  id: string;
  merchant_brand_id: string | null;
  chain: string;
  mcc: string | null;
  network: "visa" | "mastercard" | "amex" | "visa_mc" | "all";
  channel: "in_store" | "online" | "pay_at_pump";
  source_type:
    | "issuer_merchant_list"
    | "cardholder_report"
    | "blog"
    | "issuer_faq"
    | "test_purchase";
  url: string | null;
  quote: string | null;
  observed_date: string | null;
  statement_text: string | null;
  location: string | null;
  format: string | null;
  store_number: string | null;
  city: string | null;
  card_id: string | null;
  screenshot_path: string | null;
  mcc_shown: string | null;
  category_shown: string | null;
  created_at: string;
};

export type CardOption = {
  id: string;
  name: string;
  network: string | null;
};

/** List row with derived display fields. */
export type StoreCodeListItem = MerchantBrandRow & {
  code_display: string;
  category_label: string;
  evidence_count: number;
  latest_evidence_label: string | null;
  needs_evidence: boolean;
  pending_review: boolean;
};

export const BRAND_COLUMNS =
  "id, name, category, notes, source_url, last_verified, status, mcc, amex_mcc, certainty, reviewed_by";

export const EVIDENCE_COLUMNS =
  "id, merchant_brand_id, chain, mcc, network, channel, source_type, url, quote, observed_date, statement_text, location, format, store_number, city, card_id, screenshot_path, mcc_shown, category_shown, created_at";

export const STORE_CODES_PAGE_SIZE = 20;

/** Certainty filter chips (radio). "varies" covers all varies_* values. */
export const CERTAINTY_FILTERS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "varies", label: "Varies" },
  { value: "category_only", label: "Category only" },
  { value: "estimate", label: "Estimate" },
  { value: "unknown", label: "Unknown" },
  { value: "needs_evidence", label: "Needs evidence" },
] as const;

export type CertaintyFilter = (typeof CERTAINTY_FILTERS)[number]["value"];

export const DISPLAY_CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "transit",
  "drugstore",
  "recurring_bills",
  "travel",
  "foreign_currency",
  "entertainment",
  "other",
] as const;

export type DisplayCategory = (typeof DISPLAY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DisplayCategory, string> = {
  groceries: "Groceries",
  dining: "Dining & cafes",
  gas: "Gas",
  transit: "Transit",
  drugstore: "Drugstore",
  recurring_bills: "Bills",
  travel: "Travel",
  foreign_currency: "Foreign currency",
  entertainment: "Entertainment",
  other: "Everything else",
};

/** Evidence rows needed to treat a code as Confirmed (matches approve RPC). */
export const CONFIRMED_EVIDENCE_THRESHOLD = 2;
