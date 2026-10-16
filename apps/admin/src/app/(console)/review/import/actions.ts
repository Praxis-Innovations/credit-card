"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { parseResearchCsv, type CardIndex } from "@/lib/mcc-import/research";
import {
  findingKindDb,
  isImportKind,
  type ImportKind,
  type ImportResult,
} from "@/lib/mcc-import/types";

export type ImportActionResult =
  | { ok: true; message: string; result: ImportResult }
  | { ok: false; message: string };

function failure(message: string): ImportActionResult {
  return { ok: false, message };
}

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

async function loadCardIndex(supabase: SupabaseClient): Promise<CardIndex> {
  const { data } = await supabase.from("cards").select("id, name, network");
  const index: CardIndex = new Map();
  for (const row of data ?? []) {
    index.set(String(row.name).toLowerCase(), {
      id: String(row.id),
      name: String(row.name),
      network: (row.network as string | null) ?? null,
    });
  }
  return index;
}

type UpsertOutcome = "inserted" | "updated" | "unchanged" | "skipped";

/**
 * Write findings only. Never reopen an approved/rejected/ignored row — that would
 * leave stale merchant_code_evidence live and create conflict on re-approve.
 */
async function upsertFinding(
  supabase: SupabaseClient,
  write: { kind: ImportKind; idempotencyKey: string; proposed: Record<string, unknown> },
): Promise<UpsertOutcome> {
  const dbKind = findingKindDb(write.kind);
  const { data: existing, error: readError } = await supabase
    .from("merchant_code_findings")
    .select("proposed, review_status")
    .eq("kind", dbKind)
    .eq("idempotency_key", write.idempotencyKey)
    .maybeSingle();
  if (readError) throw new Error("read");

  if (existing && existing.review_status !== "pending") return "skipped";

  const prev = (existing?.proposed as Record<string, unknown> | null) ?? null;
  if (prev && stableJson(prev) === stableJson(write.proposed)) return "unchanged";

  if (existing) {
    const { error } = await supabase
      .from("merchant_code_findings")
      .update({
        proposed: write.proposed,
        updated_at: new Date().toISOString(),
      })
      .eq("kind", dbKind)
      .eq("idempotency_key", write.idempotencyKey)
      .eq("review_status", "pending");
    if (error) throw new Error("write");
    return "updated";
  }

  const { error } = await supabase.from("merchant_code_findings").insert({
    kind: dbKind,
    idempotency_key: write.idempotencyKey,
    proposed: write.proposed,
    review_status: "pending",
  });
  if (error) throw new Error("write");
  return "inserted";
}

/**
 * Admin CSV import → merchant_code_findings only (never live catalog rows).
 * Requires the admin role (same floor as inserting findings via RLS).
 */
export async function importMccResearchCsv(
  kindRaw: string,
  csvText: string,
): Promise<ImportActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (!isImportKind(kindRaw)) return failure("Pick a CSV format to import.");
  if (typeof csvText !== "string" || csvText.trim() === "") {
    return failure("Paste or upload a CSV first.");
  }
  if (csvText.length > 2_000_000) {
    return failure("That CSV is too large. Split it and try again.");
  }

  const kind: ImportKind = kindRaw;
  const cards = kind === "test_purchases" ? await loadCardIndex(auth.supabase) : new Map();
  const { writes, rejected } = parseResearchCsv(kind, csvText, cards);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  try {
    for (const write of writes) {
      const outcome = await upsertFinding(auth.supabase, write);
      if (outcome === "inserted") inserted += 1;
      else if (outcome === "updated") updated += 1;
      else if (outcome === "skipped") skipped += 1;
      else unchanged += 1;
    }
  } catch {
    return failure("Could not save findings. Try again.");
  }

  const result: ImportResult = { kind, inserted, updated, unchanged, skipped, rejected };
  revalidatePath("/review");
  revalidatePath("/review/import");
  return { ok: true, message: summarizeImport(result), result };
}

function summarizeImport(result: ImportResult): string {
  const parts = [
    result.inserted ? `${result.inserted} new` : null,
    result.updated ? `${result.updated} updated` : null,
    result.unchanged ? `${result.unchanged} unchanged` : null,
    result.skipped ? `${result.skipped} already decided (skipped)` : null,
    result.rejected.length ? `${result.rejected.length} rejected` : null,
  ].filter(Boolean);
  if (parts.length === 0) return "Nothing to import.";
  return `Import finished: ${parts.join(", ")}. Findings stay pending until approved.`;
}
