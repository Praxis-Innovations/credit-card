import type { Issuer } from "../schema";

/** Issuers in scope for this pipeline pass. */
export const BIG_SIX_ISSUERS = [
  "RBC",
  "TD",
  "Scotiabank",
  "BMO",
  "CIBC",
  "National Bank",
] as const satisfies readonly Issuer[];

export type BigSixIssuer = (typeof BIG_SIX_ISSUERS)[number];

/** Mirrors public.catalog_status in Supabase. */
export const CATALOG_STATUSES = [
  "pending",
  "verified",
  "stale",
  "rejected",
] as const;

export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export type SourceKind = "card_listing" | "partnership" | "loyalty_program";

/** Risk-based crawl scopes (see cadence.ts). */
export type CrawlScope = "full" | "cards" | "partnerships";

export interface CrawlSource {
  id: string;
  issuer: BigSixIssuer;
  kind: SourceKind;
  url: string;
  /** Merchant / loyalty brand when the page is partnership-focused. */
  brand?: string;
  notes?: string;
  /**
   * Re-verification cadence hint.
   * - cards: monthly is enough
   * - partnerships / promotional: bi-weekly
   */
  cadence?: "monthly" | "biweekly";
}

export type FactKind =
  | "card_name"
  | "annual_fee"
  | "point_currency"
  | "earn_rate"
  | "partnership_mention"
  | "benefit_amount"
  | "offer_expiry";

/**
 * One extracted claim from a public page.
 *
 * HARD RULE: these never write into cards.ts / partnerships.ts / Supabase
 * automatically. Promotion stays a reviewed human action → status=verified.
 */
export interface StagingFact {
  /** Stable-ish id for de-dupe within a run (kind|issuer|subject|rawValue|url). */
  id: string;
  kind: FactKind;
  issuer: BigSixIssuer;
  /** Merchant or loyalty brand when known. */
  brand?: string;
  /** What the fact is about (card product name, partnership label, etc.). */
  subject: string;
  /** Raw extracted text/value — preserve issuer wording. */
  rawValue: string;
  /** Optional lightly-parsed number for diffs (fees, ¢/L, earn rates). */
  parsedNumber?: number;
  /** ISO date when an offer/promo expires, if extracted from page text. */
  expiresAt?: string;
  sourceUrl: string;
  capturedAt: string;
  /** Lifecycle: staged facts start as pending. */
  status: CatalogStatus;
  /** Nearby page text for human review. */
  context?: string;
}

export type FetchOutcome =
  | "ok"
  | "robots_disallowed"
  | "http_error"
  | "network_error"
  | "empty_body";

export interface SourceAttempt {
  sourceId: string;
  url: string;
  issuer: BigSixIssuer;
  kind: SourceKind;
  capturedAt: string;
  outcome: FetchOutcome;
  httpStatus?: number;
  contentType?: string;
  bytes?: number;
  error?: string;
  robotsChecked: boolean;
}

export interface StagingSnapshot {
  pipelineVersion: string;
  runId: string;
  scope: "big-six";
  crawlScope: CrawlScope;
  capturedAt: string;
  sources: SourceAttempt[];
  facts: StagingFact[];
}

export type DiffChangeKind =
  | "new_card_candidate"
  | "removed_card_candidate"
  | "fee_change_candidate"
  | "earn_rate_change_candidate"
  | "point_currency_change_candidate"
  | "new_partnership_candidate"
  | "partnership_conflict"
  | "unchanged_signal"
  | "source_failure"
  | "expiry_review_due"
  | "source_health_failure"
  | "suppressed_rejected";

export interface CorroborationResult {
  /** Third (or additional) URL checked, if any. */
  thirdSourceUrl?: string;
  /** Raw snippet / value found on the third source. */
  thirdValue?: string;
  /** Did the third source agree with staging, production, both, or neither? */
  agreesWith?: "staging" | "production" | "both" | "neither" | "unavailable";
  note: string;
}

export interface DiffFinding {
  /** Stable fingerprint for reject/suppress across weekly runs. */
  fingerprint: string;
  kind: DiffChangeKind;
  severity: "info" | "review" | "conflict";
  /** Lifecycle intent for this finding (pending until human decides). */
  status: CatalogStatus;
  issuer: BigSixIssuer;
  subject: string;
  summary: string;
  productionValue?: string;
  stagingValue?: string;
  sourceUrls: string[];
  relatedFactIds: string[];
  /** Present on partnership_conflict after corroboration pass. */
  corroboration?: CorroborationResult;
  expiresAt?: string;
}

export interface DiffReport {
  generatedAt: string;
  runId: string;
  crawlScope: CrawlScope;
  productionCardCount: number;
  stagingFactCount: number;
  findings: DiffFinding[];
  /** Fingerprints skipped because previously rejected. */
  suppressedRejectedCount: number;
  summary: {
    newCardCandidates: number;
    removedCardCandidates: number;
    feeChanges: number;
    earnRateChanges: number;
    newPartnershipCandidates: number;
    partnershipConflicts: number;
    sourceFailures: number;
    expiryReviewsDue: number;
    sourceHealthFailures: number;
  };
}

/** Catalog table names the promote step may write. */
export type CatalogTable =
  | "cards"
  | "loyalty_programs"
  | "merchant_brands"
  | "merchant_partnerships";
