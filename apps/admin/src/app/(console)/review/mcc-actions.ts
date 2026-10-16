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

type RpcName = "approve_merchant_code_finding" | "reject_merchant_code_finding";

async function callFindingRpc(
  supabase: SupabaseClient,
  rpc: RpcName,
  id: string,
  note: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc(rpc, {
    p_finding_id: id,
    p_review_note: note,
  });
  if (error) return { ok: false, message: mapRpcError(error.message ?? "") };
  if (!data) return { ok: false, message: GONE };
  return { ok: true };
}

async function decideBulk(
  rpc: RpcName,
  ids: unknown,
  reason: string,
  verb: "Approved" | "Rejected",
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
    const res = await callFindingRpc(auth.supabase, rpc, id, note.note);
    if (res.ok) decided += 1;
    else lastError = res.message;
  }

  revalidateMccPaths();
  if (decided === 0) return failure(lastError ?? GONE);
  if (rpc === "approve_merchant_code_finding" && decided < parsedIds.ids.length) {
    return {
      ok: true,
      message: `${verb} ${decided} of ${parsedIds.ids.length} findings. ${lastError ?? ""}`.trim(),
      decided,
    };
  }
  return {
    ok: true,
    message: decided === 1 ? `${verb} 1 finding.` : `${verb} ${decided} findings.`,
    decided,
  };
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

  const res = await callFindingRpc(auth.supabase, "approve_merchant_code_finding", id, note.note);
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

  const res = await callFindingRpc(auth.supabase, "reject_merchant_code_finding", id, note.note);
  if (!res.ok) return failure(res.message);
  revalidateMccPaths();
  return { ok: true, message: "Rejected store-code finding.", decided: 1 };
}

/** Bulk approve: one shared reason, each row decided (and audited) separately. */
export async function bulkApproveMerchantCodeFindings(
  ids: unknown,
  reason: string,
): Promise<MccReviewResult> {
  return decideBulk("approve_merchant_code_finding", ids, reason, "Approved");
}

export async function bulkRejectMerchantCodeFindings(
  ids: unknown,
  reason: string,
): Promise<MccReviewResult> {
  return decideBulk("reject_merchant_code_finding", ids, reason, "Rejected");
}
