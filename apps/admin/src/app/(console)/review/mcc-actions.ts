"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { validateFindingIds, validateReviewNote } from "@/lib/mcc-review/validation";
import { isUuid } from "@/lib/sources/validation";

export type MccReviewResult =
  | { ok: true; message: string; decided: number }
  | { ok: false; message: string };

function failure(message: string): MccReviewResult {
  return { ok: false, message };
}

const GONE = "That finding was already reviewed or no longer exists. Refresh the queue.";

function mapRpcError(message: string): string {
  if (/not authorized/i.test(message)) return "Your role can't make this change.";
  if (/review note required/i.test(message)) return "Give a reason for rejecting.";
  if (/missing required fields/i.test(message)) {
    return "This finding is missing required fields and cannot be approved.";
  }
  return "Could not save the decision. Refresh and try again.";
}

function revalidateMccPaths() {
  revalidatePath("/review");
  revalidatePath("/review/import");
}

async function approveOne(
  supabase: SupabaseClient,
  id: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("approve_merchant_code_finding", {
    p_finding_id: id,
    p_review_note: note,
  });
  if (error) return { ok: false, message: mapRpcError(error.message ?? "") };
  if (!data) return { ok: false, message: GONE };
  return { ok: true };
}

async function rejectOne(
  supabase: SupabaseClient,
  id: string,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("reject_merchant_code_finding", {
    p_finding_id: id,
    p_review_note: note,
  });
  if (error) return { ok: false, message: mapRpcError(error.message ?? "") };
  if (!data) return { ok: false, message: GONE };
  return { ok: true };
}

export async function approveMerchantCodeFinding(
  id: string,
  reason: string | null = null,
): Promise<MccReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  const note = validateReviewNote(reason, { required: false });
  if (!note.ok) return failure(note.error);

  const res = await approveOne(auth.supabase, id, note.note);
  if (!res.ok) return failure(res.message);
  revalidateMccPaths();
  return { ok: true, message: "Approved store-code finding.", decided: 1 };
}

export async function rejectMerchantCodeFinding(id: string, reason: string): Promise<MccReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  const note = validateReviewNote(reason, { required: true });
  if (!note.ok) return failure(note.error);

  const res = await rejectOne(auth.supabase, id, note.note!);
  if (!res.ok) return failure(res.message);
  revalidateMccPaths();
  return { ok: true, message: "Rejected store-code finding.", decided: 1 };
}

/**
 * Bulk approve: one shared reason, each row decided (and audited) separately.
 */
export async function bulkApproveMerchantCodeFindings(
  ids: unknown,
  reason: string,
): Promise<MccReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  const parsedIds = validateFindingIds(ids);
  if (!parsedIds.ok) return failure(parsedIds.error);
  const note = validateReviewNote(reason, { required: true });
  if (!note.ok) return failure(note.error);

  let decided = 0;
  let lastError: string | null = null;
  for (const id of parsedIds.ids) {
    const res = await approveOne(auth.supabase, id, note.note);
    if (res.ok) decided += 1;
    else lastError = res.message;
  }

  revalidateMccPaths();
  if (decided === 0) return failure(lastError ?? GONE);
  if (decided < parsedIds.ids.length) {
    return {
      ok: true,
      message: `Approved ${decided} of ${parsedIds.ids.length} findings. ${lastError ?? ""}`.trim(),
      decided,
    };
  }
  return {
    ok: true,
    message: decided === 1 ? "Approved 1 finding." : `Approved ${decided} findings.`,
    decided,
  };
}

export async function bulkRejectMerchantCodeFindings(
  ids: unknown,
  reason: string,
): Promise<MccReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  const parsedIds = validateFindingIds(ids);
  if (!parsedIds.ok) return failure(parsedIds.error);
  const note = validateReviewNote(reason, { required: true });
  if (!note.ok) return failure(note.error);

  let decided = 0;
  let lastError: string | null = null;
  for (const id of parsedIds.ids) {
    const res = await rejectOne(auth.supabase, id, note.note!);
    if (res.ok) decided += 1;
    else lastError = res.message;
  }

  revalidateMccPaths();
  if (decided === 0) return failure(lastError ?? GONE);
  return {
    ok: true,
    message: decided === 1 ? "Rejected 1 finding." : `Rejected ${decided} findings.`,
    decided,
  };
}
