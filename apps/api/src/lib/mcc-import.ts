/**
 * MCC research CSV → merchant_code_findings only.
 * Never writes live mcc_codes / merchant_brands / category_mccs rows.
 * Idempotent upserts keyed per format (see Locked scope for MC1).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateAndBuildFindings } from "./mcc-import-build";
import { parseStatementText, resolveCatalogCardName } from "./mcc-import-shared";
import {
  IMPORT_KINDS,
  type FindingStore,
  type FindingWrite,
  type ImportKind,
  type ImportResult,
} from "./mcc-import-types";

export { IMPORT_KINDS } from "./mcc-import-types";
export type {
  FindingStore,
  FindingWrite,
  ImportKind,
  ImportResult,
} from "./mcc-import-types";

export { parseStatementText, resolveCatalogCardName };
export { validateAndBuildFindings };

function stableJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, Object.keys(value).sort());
}

function findingKindDb(kind: ImportKind): string {
  switch (kind) {
    case "store_codes":
      return "store_code";
    case "test_purchases":
      return "test_purchase";
    case "mcc_codes":
      return "mcc_code";
    case "category_mccs":
      return "category_mcc";
    case "store_type_mccs":
      return "store_type_mcc";
  }
}

export function createSupabaseFindingStore(
  client?: SupabaseClient,
): FindingStore {
  const supabase =
    client ??
    (() => {
      const url = process.env.SUPABASE_URL?.trim();
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!url || !key) {
        throw new Error(
          "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to import",
        );
      }
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();

  return {
    async get(kind, idempotencyKey) {
      const { data, error } = await supabase
        .from("merchant_code_findings")
        .select("proposed")
        .eq("kind", findingKindDb(kind))
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.proposed as Record<string, unknown> | null) ?? null;
    },
    async upsert(write) {
      const existing = await this.get(write.kind, write.idempotencyKey);
      if (existing && stableJson(existing) === stableJson(write.proposed)) {
        return "unchanged";
      }
      const { error } = await supabase.from("merchant_code_findings").upsert(
        {
          kind: findingKindDb(write.kind),
          idempotency_key: write.idempotencyKey,
          proposed: write.proposed,
          review_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "kind,idempotency_key" },
      );
      if (error) throw new Error(error.message);
      return existing ? "updated" : "inserted";
    },
  };
}

/** In-memory store for unit tests / dry admin previews. */
export function createMemoryFindingStore(
  seed: FindingWrite[] = [],
): FindingStore & { rows: Map<string, FindingWrite> } {
  const rows = new Map<string, FindingWrite>();
  for (const w of seed) {
    rows.set(`${w.kind}|${w.idempotencyKey}`, w);
  }
  return {
    rows,
    async get(kind, key) {
      return rows.get(`${kind}|${key}`)?.proposed ?? null;
    },
    async upsert(write) {
      const k = `${write.kind}|${write.idempotencyKey}`;
      const existing = rows.get(k);
      if (existing && stableJson(existing.proposed) === stableJson(write.proposed)) {
        return "unchanged";
      }
      rows.set(k, write);
      return existing ? "updated" : "inserted";
    },
  };
}

export async function importMccCsv(
  kind: ImportKind,
  csvText: string,
  store: FindingStore,
): Promise<ImportResult> {
  const { writes, rejected } = validateAndBuildFindings(kind, csvText);
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const write of writes) {
    const outcome = await store.upsert(write);
    if (outcome === "inserted") inserted += 1;
    else if (outcome === "updated") updated += 1;
    else unchanged += 1;
  }

  return { kind, inserted, updated, unchanged, rejected };
}

export function isImportKind(value: string): value is ImportKind {
  return (IMPORT_KINDS as readonly string[]).includes(value);
}
