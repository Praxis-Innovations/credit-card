import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiffKind, ReviewFields } from "./types";

export type ApplyToCatalogInput = {
  findingId: string;
  linkedCardId: string | null;
  diffKind: DiffKind | null;
  cardName: string | null;
  issuerName: string | null;
  fields: ReviewFields;
};

export type ApplyToCatalogResult = { ok: true } | { ok: false; message: string };

/**
 * Writes accepted field values to `public.cards` when a finding is approved.
 *
 * Called from Approve and next so values go live in the same step as the
 * review decision — there is no separate "Promote approved" UI. The catalog
 * write itself is AD2 (#29): replace this stub with the real upsert (new card
 * or per-field update) and prefer one DB transaction with the finding update.
 */
export async function applyApprovedFindingToCatalog(
  supabase: SupabaseClient,
  input: ApplyToCatalogInput,
): Promise<ApplyToCatalogResult> {
  // AD2 (#29): implement the cards write here (or via a SECURITY DEFINER RPC
  // that also stamps the finding, so approve + catalog stay atomic).
  void supabase;
  void input;
  return { ok: true };
}
