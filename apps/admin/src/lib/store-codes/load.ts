import type { SupabaseClient } from "@supabase/supabase-js";
import { chainFromFinding } from "@/lib/mcc-review/present";
import {
  FINDING_COLUMNS,
  STORE_CODE_KINDS,
  type MerchantCodeFinding,
} from "@/lib/mcc-review/types";
import { toListItem } from "./present";
import {
  BRAND_COLUMNS,
  EVIDENCE_COLUMNS,
  type CardOption,
  type EvidenceRow,
  type MerchantBrandRow,
  type StoreCodeListItem,
} from "./types";

type PendingFinding = Pick<MerchantCodeFinding, "proposed" | "kind">;

/**
 * Load every merchant brand with evidence counts for the Store codes list.
 * At ~2,000 chains this is a few round-trips; filters/pagination stay client-side.
 */
export async function loadStoreCodeList(supabase: SupabaseClient): Promise<{
  items: StoreCodeListItem[];
  error: string | null;
}> {
  const [brandsRes, evidenceRes, pendingRes] = await Promise.all([
    supabase
      .from("merchant_brands")
      .select(BRAND_COLUMNS)
      .order("name")
      .returns<MerchantBrandRow[]>(),
    supabase
      .from("merchant_code_evidence")
      .select(EVIDENCE_COLUMNS)
      .returns<EvidenceRow[]>(),
    supabase
      .from("merchant_code_findings")
      .select(FINDING_COLUMNS)
      .eq("review_status", "pending")
      .in("kind", [...STORE_CODE_KINDS])
      .returns<PendingFinding[]>(),
  ]);

  if (brandsRes.error) {
    return { items: [], error: "Could not load store codes. Refresh to try again." };
  }

  const evidenceIndex = indexEvidence(evidenceRes.data ?? []);
  const pendingChains = pendingChainKeys(pendingRes.data ?? []);

  const items = (brandsRes.data ?? []).map((brand) => {
    const evidence = evidenceForBrand(brand, evidenceIndex);
    const pending = pendingChains.has(brand.name.toLowerCase()) || pendingChains.has(brand.id);
    return toListItem(brand, evidence, pending);
  });

  return { items, error: null };
}

export async function loadStoreCodeDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<{
  brand: MerchantBrandRow | null;
  evidence: EvidenceRow[];
  pendingReview: boolean;
  cards: CardOption[];
  error: string | null;
}> {
  const [brandRes, evidenceRes, pendingRes, cardsRes] = await Promise.all([
    supabase.from("merchant_brands").select(BRAND_COLUMNS).eq("id", id).maybeSingle<MerchantBrandRow>(),
    supabase
      .from("merchant_code_evidence")
      .select(EVIDENCE_COLUMNS)
      .eq("merchant_brand_id", id)
      .order("observed_date", { ascending: false, nullsFirst: false })
      .returns<EvidenceRow[]>(),
    supabase
      .from("merchant_code_findings")
      .select(FINDING_COLUMNS)
      .eq("review_status", "pending")
      .in("kind", [...STORE_CODE_KINDS])
      .returns<PendingFinding[]>(),
    supabase.from("cards").select("id, name, network").order("name").returns<CardOption[]>(),
  ]);

  if (brandRes.error) {
    return {
      brand: null,
      evidence: [],
      pendingReview: false,
      cards: [],
      error: "Could not load this store. Refresh to try again.",
    };
  }
  if (!brandRes.data) {
    return { brand: null, evidence: [], pendingReview: false, cards: [], error: null };
  }

  const brand = brandRes.data;
  const pendingChains = pendingChainKeys(pendingRes.data ?? []);
  const pendingReview =
    pendingChains.has(brand.name.toLowerCase()) || pendingChains.has(brand.id);

  return {
    brand,
    evidence: evidenceRes.data ?? [],
    pendingReview,
    cards: cardsRes.data ?? [],
    error: null,
  };
}

type EvidenceIndex = {
  byBrandId: Map<string, EvidenceRow[]>;
  byChain: Map<string, EvidenceRow[]>;
};

function indexEvidence(rows: EvidenceRow[]): EvidenceIndex {
  const byBrandId = new Map<string, EvidenceRow[]>();
  const byChain = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    if (row.merchant_brand_id) {
      const list = byBrandId.get(row.merchant_brand_id) ?? [];
      list.push(row);
      byBrandId.set(row.merchant_brand_id, list);
    }
    const chainKey = row.chain.trim().toLowerCase();
    if (chainKey) {
      const list = byChain.get(chainKey) ?? [];
      list.push(row);
      byChain.set(chainKey, list);
    }
  }
  return { byBrandId, byChain };
}

function evidenceForBrand(brand: MerchantBrandRow, index: EvidenceIndex): EvidenceRow[] {
  const byId = index.byBrandId.get(brand.id) ?? [];
  const byName = index.byChain.get(brand.name.toLowerCase()) ?? [];
  if (byName.length === 0) return byId;
  const seen = new Set(byId.map((e) => e.id));
  const merged = [...byId];
  for (const row of byName) {
    if (!seen.has(row.id)) merged.push(row);
  }
  return merged;
}

function pendingChainKeys(findings: PendingFinding[]): Set<string> {
  const keys = new Set<string>();
  for (const f of findings) {
    const chain = chainFromFinding(f as MerchantCodeFinding);
    keys.add(chain.toLowerCase());
  }
  return keys;
}
