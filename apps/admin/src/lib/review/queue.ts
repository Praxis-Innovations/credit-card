import type { SupabaseClient } from "@supabase/supabase-js";
import { FINDING_COLUMNS, type DiffKind, type PendingFinding } from "./types";

/**
 * What the Review queue shows. Cards with no changes are stored by the crawler
 * as review_status = 'checked' and never appear; the diff_kind filter keeps
 * them out even if an older row is still 'pending'.
 */
export const QUEUE_DIFF_KINDS = ["new", "changed", "possibly_discontinued"] as const satisfies readonly DiffKind[];

export const REVIEW_PAGE_SIZE = 200;

export function loadReviewQueue(supabase: SupabaseClient) {
  return supabase
    .from("card_findings")
    .select(FINDING_COLUMNS)
    .eq("review_status", "pending")
    .in("diff_kind", QUEUE_DIFF_KINDS)
    .order("created_at", { ascending: false })
    .limit(REVIEW_PAGE_SIZE)
    .returns<PendingFinding[]>();
}
