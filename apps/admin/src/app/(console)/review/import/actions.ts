"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { validateAndBuildFindings, type CardLookup } from "@/lib/mcc-import/build";
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

async function loadCardLookup(supabase: SupabaseClient): Promise<CardLookup> {
  const { data } = await supabase.from("cards").select("id, name, network");
  const byName = new Map<string, { id: string; name: string; network: string | null }>();
  for (const row of data ?? []) {
    byName.set(String(row.name).toLowerCase(), {
      id: String(row.id),
      name: String(row.name),
      network: (row.network as string | null) ?? null,
    });
  }
  return { byName };
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
  const cards =
    kind === "test_purchases" ? await loadCardLookup(auth.supabase) : { byName: new Map() };
  const { writes, rejected } = validateAndBuildFindings(kind, csvText, cards);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const write of writes) {
    const dbKind = findingKindDb(write.kind);
    const { data: existing, error: readError } = await auth.supabase
      .from("merchant_code_findings")
      .select("proposed")
      .eq("kind", dbKind)
      .eq("idempotency_key", write.idempotencyKey)
      .maybeSingle();
    if (readError) return failure("Could not check existing findings. Try again.");

    const prev = (existing?.proposed as Record<string, unknown> | null) ?? null;
    if (prev && stableJson(prev) === stableJson(write.proposed)) {
      unchanged += 1;
      continue;
    }

    const { error } = await auth.supabase.from("merchant_code_findings").upsert(
      {
        kind: dbKind,
        idempotency_key: write.idempotencyKey,
        proposed: write.proposed,
        review_status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "kind,idempotency_key" },
    );
    if (error) return failure("Could not save findings. Try again.");
    if (prev) updated += 1;
    else inserted += 1;
  }

  const result: ImportResult = { kind, inserted, updated, unchanged, rejected };
  revalidatePath("/review");
  revalidatePath("/review/import");

  const parts = [
    inserted ? `${inserted} new` : null,
    updated ? `${updated} updated` : null,
    unchanged ? `${unchanged} unchanged` : null,
    rejected.length ? `${rejected.length} rejected` : null,
  ].filter(Boolean);

  return {
    ok: true,
    message:
      parts.length > 0
        ? `Import finished: ${parts.join(", ")}. Findings stay pending until approved.`
        : "Nothing to import.",
    result,
  };
}
