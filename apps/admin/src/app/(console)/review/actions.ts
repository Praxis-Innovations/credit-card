"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation, type ConsoleSession } from "@/lib/auth/guard";
import { validateRejectReason } from "@/lib/review/validation";
import { isUuid } from "@/lib/sources/validation";

export type ReviewResult = { ok: true; message: string } | { ok: false; message: string };

function failure(message: string): ReviewResult {
  return { ok: false, message };
}

type AuthorizedSession = { ok: true } & ConsoleSession;

const GONE = "That finding was already reviewed or no longer exists. Refresh the queue.";

/**
 * Records a decision on a pending finding. Validators and admins may review
 * (the least privilege that matches the database policy; viewers read only).
 * The update is conditional on review_status = 'pending', so two reviewers
 * cannot both decide the same finding. Nothing is written to `cards`.
 */
async function decide(
  auth: AuthorizedSession,
  id: string,
  status: "approved" | "rejected",
  note: string | null,
): Promise<ReviewResult> {
  const { supabase, email } = auth;

  const { data: updated, error } = await supabase
    .from("card_findings")
    .update({
      review_status: status,
      review_note: note,
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("id, card_name");
  if (error) return failure("Could not save the decision. Refresh and try again.");
  if (!updated || updated.length === 0) return failure(GONE);

  revalidatePath("/review");
  const name = (updated[0] as { card_name: string | null }).card_name ?? "finding";
  return { ok: true, message: `${status === "approved" ? "Approved" : "Rejected"} ${name}.` };
}

export async function approveFinding(id: string): Promise<ReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  return decide(auth, id, "approved", null);
}

export async function rejectFinding(id: string, reason: string): Promise<ReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  const parsed = validateRejectReason(reason);
  if (!parsed.ok) return failure(parsed.error);
  return decide(auth, id, "rejected", parsed.reason);
}
