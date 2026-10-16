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

export function loadFinding(supabase: SupabaseClient, id: string) {
  return supabase.from("card_findings").select(FINDING_COLUMNS).eq("id", id).returns<PendingFinding>().maybeSingle();
}

export type QueueNeighbors = {
  finding: PendingFinding;
  index: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
};

/**
 * Loads one pending finding in queue order and the ids of its neighbors for
 * Previous / Skip / Approve and next.
 */
export async function loadFindingInQueue(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: QueueNeighbors | null; error: Error | null }> {
  const queue = await loadReviewQueue(supabase);
  if (queue.error) return { data: null, error: new Error(queue.error.message) };

  const findings = queue.data ?? [];
  const index = findings.findIndex((f) => f.id === id);
  if (index < 0) {
    // Not in the pending queue — still show it if it exists (already decided).
    const one = await loadFinding(supabase, id);
    if (one.error) return { data: null, error: new Error(one.error.message) };
    if (!one.data) return { data: null, error: null };
    return {
      data: {
        finding: one.data,
        index: 0,
        total: 0,
        previousId: null,
        nextId: null,
      },
      error: null,
    };
  }

  return {
    data: {
      finding: findings[index]!,
      index,
      total: findings.length,
      previousId: index > 0 ? findings[index - 1]!.id : null,
      nextId: index < findings.length - 1 ? findings[index + 1]!.id : null,
    },
    error: null,
  };
}
