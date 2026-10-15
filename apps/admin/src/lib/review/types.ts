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

/** Only the parts of the extraction the review page reads. */
export type Extraction = {
  card_name?: Quoted<string> | null;
  network?: Quoted<string> | null;
  annual_fee?: Quoted<number> | null;
  earn_rates?: Array<{ category: string; rate: number; unit: string; quote: string }>;
  welcome_bonus?: Quoted<{ summary: string; points: number | null }> | null;
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

export const FINDING_COLUMNS =
  "id, run_id, product_url, card_name, extracted, check_results, flagged_count, diff_kind, diff, linked_card_id, created_at, source:crawl_sources(issuer_name), run:crawl_runs(created_at)";

export const MAX_REVIEW_NOTE = 1000;
