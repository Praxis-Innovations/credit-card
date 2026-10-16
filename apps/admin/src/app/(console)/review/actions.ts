"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation, type ConsoleSession } from "@/lib/auth/guard";
import { applyApprovedFindingToCatalog } from "@/lib/review/apply-to-catalog";
import { buildFieldRows, type FieldRow } from "@/lib/review/present";
import type { DiffKind, Extraction, ReviewFields } from "@/lib/review/types";
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

async function finishDecision(
  auth: AuthorizedSession,
  id: string,
  verb: "Approved" | "Rejected",
  name: string | null,
): Promise<ReviewResult> {
  revalidatePath("/review");
  revalidatePath(`/review/${id}`);
  return {
    ok: true,
    message: `${verb} ${name ?? "finding"}.`,
    nextId: await nextPendingId(auth, id),
  };
}

/**
 * Records a reject decision on a pending finding. Validators and admins may
 * review (the least privilege that matches the database policy; viewers read
 * only). The update is conditional on review_status = 'pending', so two
 * reviewers cannot both decide the same finding. Reject leaves the live
 * catalog unchanged.
 */
async function decideReject(
  auth: AuthorizedSession,
  id: string,
  note: string,
): Promise<ReviewResult> {
  const { supabase, email } = auth;

  const { data: updated, error } = await supabase
    .from("card_findings")
    .update({
      review_status: "rejected",
      review_note: note,
      review_fields: null,
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("id, card_name");
  if (error) return failure("Could not save the decision. Refresh and try again.");
  if (!updated || updated.length === 0) return failure(GONE);
  const name = (updated[0] as { card_name: string | null }).card_name;
  return finishDecision(auth, id, "Rejected", name);
}

function issuerNameFrom(source: unknown): string | null {
  if (Array.isArray(source)) return (source[0] as { issuer_name?: string } | undefined)?.issuer_name ?? null;
  if (source && typeof source === "object") return (source as { issuer_name?: string }).issuer_name ?? null;
  return null;
}

/** page_value from the finding; unsaved edits reset to page_value. */
function normalizeReviewFields(
  rows: FieldRow[],
  fields: ReviewFields,
): ReviewFields {
  const pageByKey = new Map(rows.map((r) => [r.key, r.proposed]));
  return {
    fields: fields.fields.map((f) => {
      const page_value = pageByKey.get(f.key)!;
      return { ...f, page_value, value: f.save ? f.value : page_value };
    }),
  };
}

/**
 * Approves a pending finding and writes accepted values to `cards` in the same
 * DB transaction as the audit entry (AD2). Call once per finding — bulk approve
 * should invoke this per row with that row's field decisions.
 */
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
  const parsed = validateReviewFields(fields, new Set(rows.map((r) => r.key)));
  if (!parsed.ok) return failure(parsed.error);
  const reviewFields = normalizeReviewFields(rows, parsed.fields);

  const applied = await applyApprovedFindingToCatalog(auth.supabase, {
    findingId: id,
    linkedCardId: (finding.linked_card_id as string | null) ?? null,
    diffKind: (finding.diff_kind as DiffKind | null) ?? null,
    cardName: (finding.card_name as string | null) ?? null,
    issuerName: issuerNameFrom(finding.source),
    fields: reviewFields,
    extracted: (finding.extracted as Extraction | null) ?? null,
  });
  if (!applied.ok) return failure(applied.message);
  return finishDecision(auth, id, "Approved", applied.cardName);
}

export async function rejectFinding(id: string, reason: string): Promise<ReviewResult> {
  const auth = await authorizeMutation("validator");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure(GONE);
  const parsed = validateRejectReason(reason);
  if (!parsed.ok) return failure(parsed.error);
  return decideReject(auth, id, parsed.reason);
}
