"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation, type ConsoleSession } from "@/lib/auth/guard";
import { applyApprovedFindingToCatalog } from "@/lib/review/apply-to-catalog";
import { buildFieldRows } from "@/lib/review/present";
import type { DiffKind, ReviewFields } from "@/lib/review/types";
import { validateRejectReason, validateReviewFields } from "@/lib/review/validation";
import { isUuid } from "@/lib/sources/validation";

export type ReviewResult =
  | { ok: true; message: string; nextId: string | null }
  | { ok: false; message: string };

function failure(message: string): ReviewResult {
  return { ok: false, message };
}

type AuthorizedSession = { ok: true } & ConsoleSession;

const GONE = "That finding was already reviewed or no longer exists. Refresh the queue.";

async function nextPendingId(auth: AuthorizedSession, exceptId: string): Promise<string | null> {
  const { data } = await auth.supabase
    .from("card_findings")
    .select("id")
    .eq("review_status", "pending")
    .in("diff_kind", ["new", "changed", "possibly_discontinued"])
    .neq("id", exceptId)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Records a decision on a pending finding. Validators and admins may review
 * (the least privilege that matches the database policy; viewers read only).
 * The update is conditional on review_status = 'pending', so two reviewers
 * cannot both decide the same finding.
 *
 * On approve, {@link applyApprovedFindingToCatalog} runs first so accepted
 * values go live with Approve and next (AD2 owns that write). Reject leaves
 * the live catalog unchanged.
 */
async function decide(
  auth: AuthorizedSession,
  id: string,
  status: "approved" | "rejected",
  note: string | null,
  reviewFields: ReviewFields | null,
): Promise<ReviewResult> {
  const { supabase, email } = auth;

  const { data: updated, error } = await supabase
    .from("card_findings")
    .update({
      review_status: status,
      review_note: note,
      review_fields: reviewFields,
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("id, card_name");
  if (error) return failure("Could not save the decision. Refresh and try again.");
  if (!updated || updated.length === 0) return failure(GONE);

  revalidatePath("/review");
  revalidatePath(`/review/${id}`);
  const name = (updated[0] as { card_name: string | null }).card_name ?? "finding";
  const nextId = await nextPendingId(auth, id);
  return {
    ok: true,
    message: `${status === "approved" ? "Approved" : "Rejected"} ${name}.`,
    nextId,
  };
}

export async function approveFinding(id: string, fields: unknown): Promise<ReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);

  const { data: finding, error } = await auth.supabase
    .from("card_findings")
    .select(
      "id, card_name, extracted, check_results, diff, diff_kind, linked_card_id, review_status, source:crawl_sources(issuer_name)",
    )
    .eq("id", id)
    .eq("review_status", "pending")
    .maybeSingle();
  if (error) return failure("Could not load the finding. Refresh and try again.");
  if (!finding) return failure(GONE);

  const rows = buildFieldRows(finding);
  const allowed = new Set(rows.map((r) => r.key));
  const parsed = validateReviewFields(fields, allowed);
  if (!parsed.ok) return failure(parsed.error);

  // page_value is authoritative from the finding, not the client — otherwise a
  // tampered payload can hide edits from admin_audit or mis-record what the page said.
  // Unticked Save keeps any typed value in the UI; reset it here so nothing unsaved
  // is stored or audited as an edit (the DB trigger also filters on save).
  const pageByKey = new Map(rows.map((r) => [r.key, r.proposed]));
  const reviewFields: ReviewFields = {
    fields: parsed.fields.fields.map((f) => {
      const page_value = pageByKey.get(f.key)!;
      return { ...f, page_value, value: f.save ? f.value : page_value };
    }),
  };

  const source = finding.source as { issuer_name: string } | { issuer_name: string }[] | null;
  const issuerName = Array.isArray(source) ? (source[0]?.issuer_name ?? null) : (source?.issuer_name ?? null);

  const applied = await applyApprovedFindingToCatalog(auth.supabase, {
    findingId: id,
    linkedCardId: (finding.linked_card_id as string | null) ?? null,
    diffKind: (finding.diff_kind as DiffKind | null) ?? null,
    cardName: (finding.card_name as string | null) ?? null,
    issuerName,
    fields: reviewFields,
  });
  if (!applied.ok) return failure(applied.message);

  return decide(auth, id, "approved", null, reviewFields);
}

export async function rejectFinding(id: string, reason: string): Promise<ReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  const parsed = validateRejectReason(reason);
  if (!parsed.ok) return failure(parsed.error);
  return decide(auth, id, "rejected", parsed.reason, null);
}
