import type { CardExtraction } from "./extract/schema";
import type { CheckResult } from "./checks";
import type { DiffResult } from "./diff";

export type SourceStatus = "active" | "paused" | "not_set_up" | "blocked";

export interface CrawlSource {
  /** Null only for the built-in dry-run fallback. */
  id: string | null;
  issuer_name: string;
  compare_url: string | null;
  url_pattern: string | null;
  status: SourceStatus | string;
}

/** A catalog row from public.cards (only the columns the diff needs). */
export interface CatalogCard {
  id: string;
  name: string;
  issuer: string;
  annual_fee: number;
  network: string | null;
  point_currency: string;
  reward_categories: Array<{ category: string; earnRate: number; capMonthly?: number; capAnnual?: number }>;
  welcome_offer: { summary: string; estimatedValueCad?: number } | null;
}

export interface PageLink {
  url: string;
  text: string;
}

export interface CardLink {
  card_name: string;
  url: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export type SkipReason =
  | "robots_disallowed"
  | "robots_unreachable"
  | "blocked"
  | "http_error"
  | "network_error"
  | "empty_page"
  | "extraction_failed";

export interface SkippedPage {
  url: string;
  reason: SkipReason;
  detail: string;
}

export interface CardFinding {
  card_name: string | null;
  product_url: string | null;
  page_hash: string | null;
  extracted: CardExtraction | null;
  checks: CheckResult | null;
  diff: DiffResult;
  /** True when the page hash matched the previous fetch and the prior extraction was reused. */
  reused: boolean;
  model: string | null;
  usage: Usage | null;
  cost_usd: number;
}
