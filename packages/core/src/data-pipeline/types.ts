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

export type SourceKind = "card_listing" | "partnership" | "loyalty_program";

export interface CrawlSource {
  id: string;
  issuer: BigSixIssuer;
  kind: SourceKind;
  url: string;
  /** Merchant / loyalty brand when the page is partnership-focused. */
  brand?: string;
  notes?: string;
}

export type FactKind =
  | "card_name"
  | "annual_fee"
  | "point_currency"
  | "earn_rate"
  | "partnership_mention"
  | "benefit_amount";

/**
 * One extracted claim from a public page.
 *
 * HARD RULE: these never write into cards.ts / partnerships.ts automatically.
 * Promotion stays a reviewed human action.
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
  sourceUrl: string;
  capturedAt: string;
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
  | "source_failure";

export interface DiffFinding {
  kind: DiffChangeKind;
  severity: "info" | "review" | "conflict";
  issuer: BigSixIssuer;
  subject: string;
  summary: string;
  productionValue?: string;
  stagingValue?: string;
  sourceUrls: string[];
  relatedFactIds: string[];
}

export interface DiffReport {
  generatedAt: string;
  runId: string;
  productionCardCount: number;
  stagingFactCount: number;
  findings: DiffFinding[];
  summary: {
    newCardCandidates: number;
    removedCardCandidates: number;
    feeChanges: number;
    earnRateChanges: number;
    newPartnershipCandidates: number;
    partnershipConflicts: number;
    sourceFailures: number;
  };
}
