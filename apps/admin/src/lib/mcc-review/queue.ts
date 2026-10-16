import type { SupabaseClient } from "@supabase/supabase-js";
import { chainFromFinding } from "./present";
import {
  BRAND_COLUMNS,
  FINDING_COLUMNS,
  MCC_REVIEW_PAGE_SIZE,
  STORE_CODE_KINDS,
  type BrandSnapshot,
  type MerchantCodeFinding,
} from "./types";

/** Pending store-code / test-purchase findings for the Store codes review tab. */
export function loadStoreCodeQueue(supabase: SupabaseClient) {
  return supabase
    .from("merchant_code_findings")
    .select(FINDING_COLUMNS)
    .eq("review_status", "pending")
    .in("kind", [...STORE_CODE_KINDS])
    .order("created_at", { ascending: false })
    .limit(MCC_REVIEW_PAGE_SIZE)
    .returns<MerchantCodeFinding[]>();
}

export function loadBrandSnapshots(supabase: SupabaseClient, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return Promise.resolve({ data: [] as BrandSnapshot[], error: null });
  }
  // Case-sensitive `in`; present.ts also matches lower(name) for display.
  return supabase
    .from("merchant_brands")
    .select(BRAND_COLUMNS)
    .in("name", unique)
    .returns<BrandSnapshot[]>();
}

export async function loadStoreCodeQueueWithBrands(supabase: SupabaseClient): Promise<{
  findings: MerchantCodeFinding[];
  brands: BrandSnapshot[];
  truncated: boolean;
  error: string | null;
}> {
  const queue = await loadStoreCodeQueue(supabase);
  if (queue.error) {
    return {
      findings: [],
      brands: [],
      truncated: false,
      error: "Could not load store-code findings. Refresh to try again.",
    };
  }
  const findings = queue.data ?? [];
  const brandsRes = await loadBrandSnapshots(
    supabase,
    findings.map((f) => chainFromFinding(f)),
  );
  if (brandsRes.error) {
    return {
      findings,
      brands: [],
      truncated: findings.length >= MCC_REVIEW_PAGE_SIZE,
      error: "Could not load merchant brands. Refresh to try again.",
    };
  }
  return {
    findings,
    brands: brandsRes.data ?? [],
    truncated: findings.length >= MCC_REVIEW_PAGE_SIZE,
    error: null,
  };
}

export function loadMerchantCodeFinding(supabase: SupabaseClient, id: string) {
  return supabase
    .from("merchant_code_findings")
    .select(FINDING_COLUMNS)
    .eq("id", id)
    .returns<MerchantCodeFinding>()
    .maybeSingle();
}
