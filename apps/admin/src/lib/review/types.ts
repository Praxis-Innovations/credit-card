/**
 * Wire shapes of public.card_findings JSON columns, as written by apps/crawler.
 * Hand-written copies: apps/admin imports nothing from apps/crawler.
 */
export type DiffKind = "new" | "changed" | "unchanged" | "possibly_discontinued";

export type FieldCheck = {
  field: string;
  quote_found: boolean;
  value_in_quote: boolean | null;
  in_range: boolean | null;
  ok: boolean;
  issues: string[];
};

export type CheckResult = {
  ok: boolean;
  total: number;
  flagged: number;
  fields: FieldCheck[];
};

export type FieldChange = {
  field: string;
  catalog: string | number | null;
  extracted: string | number | null;
  flagged: boolean;
};

export type DiffResult = {
  kind: DiffKind | null;
  linked_card_id: string | null;
  match: "linked" | "name" | null;
  changes: FieldChange[];
  note?: string;
};

type Quoted<T> = { value: T; quote: string };

/** Earn-rate MCC / cap / tier fields from the crawler (snake_case in findings JSON). */
export type ExtractedEarnRate = {
  category: string;
  rate: number;
  unit: string;
  quote: string;
  description?: string;
  mccs?: string[];
  merchants?: string[];
  mcc_source?: "terms" | "network_default";
  exclusions?: string[];
  cap_amount?: number | null;
  cap_period?: string | null;
  cap_group?: string | null;
  rate_after_cap?: number | null;
  tier_threshold?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  source_url?: string | null;
};

export type ExtractedWelcomeBonus = {
  summary: string;
  points: number | null;
  cashback_cad?: number | null;
  rate?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  new_cardholders_only?: boolean | null;
};

export type ExtractedPromotion = {
  summary: string;
  rate: number | null;
  points: number | null;
  categories: string[];
  valid_from: string | null;
  valid_to: string | null;
  quote: string;
  source_url?: string | null;
};

/** Only the parts of the extraction the review page / approve path read. */
export type Extraction = {
  card_name?: Quoted<string> | null;
  network?: Quoted<string> | null;
  annual_fee?: Quoted<number> | null;
  reward_currency?: Quoted<string> | null;
  earn_rates?: ExtractedEarnRate[];
  welcome_bonus?: Quoted<ExtractedWelcomeBonus> | null;
  promotions?: ExtractedPromotion[];
};

export type PendingFinding = {
  id: string;
  run_id: string;
  product_url: string | null;
  card_name: string | null;
  extracted: Extraction | null;
  check_results: CheckResult | null;
  flagged_count: number;
  diff_kind: DiffKind | null;
  diff: DiffResult | null;
  linked_card_id: string | null;
  created_at: string;
  source: { issuer_name: string } | null;
  run: { created_at: string } | null;
};

/** One field decision written with an approve (or left null on reject). */
export type FieldDecision = {
  key: string;
  /** When false: new card saves empty; live card keeps the catalog value. */
  save: boolean;
  /** Value the crawler extracted from the page (before any edit). */
  page_value: string;
  /** Value the reviewer confirmed (equals page_value unless edited). */
  value: string;
};

export type ReviewFields = {
  fields: FieldDecision[];
};

export const FINDING_COLUMNS =
  "id, run_id, product_url, card_name, extracted, check_results, flagged_count, diff_kind, diff, linked_card_id, created_at, source:crawl_sources(issuer_name), run:crawl_runs(created_at)";

export const MAX_REVIEW_NOTE = 1000;
/** Long enough for comma-joined MCC lists and merchant names. */
export const MAX_FIELD_VALUE = 1000;
