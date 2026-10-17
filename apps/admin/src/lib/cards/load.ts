import type { SupabaseClient } from "@supabase/supabase-js";
import type { Extraction } from "@/lib/review/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  CARD_AUDIT_COLUMNS,
  CARD_COLUMNS,
  type CardAuditEntry,
  type CatalogCard,
  type CatalogCardListItem,
} from "./types";

type SourceName = { issuer_name: string };
type PendingLink = { linked_card_id: string | null };
type ApprovedFinding = { extracted: Extraction | null };

/**
 * Load the catalog for the Cards list, plus pending-change and crawl-source flags.
 * Pages past the PostgREST 1,000-row cap; filters/pagination stay client-side.
 */
export async function loadCatalogCards(supabase: SupabaseClient): Promise<{
  cards: CatalogCardListItem[];
  error: string | null;
}> {
  const [cardsRes, pendingRes, sourcesRes] = await Promise.all([
    fetchAllRows<CatalogCard>((from, to) =>
      supabase
        .from("cards")
        .select(CARD_COLUMNS)
        .order("issuer")
        .order("name")
        .order("id")
        .range(from, to)
        .returns<CatalogCard[]>(),
    ),
    fetchAllRows<PendingLink>((from, to) =>
      supabase
        .from("card_findings")
        .select("linked_card_id")
        .eq("review_status", "pending")
        .not("linked_card_id", "is", null)
        .order("linked_card_id")
        .order("id")
        .range(from, to)
        .returns<PendingLink[]>(),
    ),
    fetchAllRows<SourceName>((from, to) =>
      supabase
        .from("crawl_sources")
        .select("issuer_name")
        .order("issuer_name")
        .order("id")
        .range(from, to)
        .returns<SourceName[]>(),
    ),
  ]);

  if (cardsRes.error || pendingRes.error || sourcesRes.error) {
    return { cards: [], error: "Could not load the card catalog. Refresh to try again." };
  }

  const pendingIds = new Set(
    pendingRes.data.map((r) => r.linked_card_id).filter((id): id is string => Boolean(id)),
  );
  const sourceIssuers = new Set(sourcesRes.data.map((s) => s.issuer_name.trim().toLowerCase()));

  const cards: CatalogCardListItem[] = cardsRes.data.map((c) => ({
    ...c,
    reward_categories: Array.isArray(c.reward_categories) ? c.reward_categories : [],
    pending_change: pendingIds.has(c.id),
    has_crawl_source: sourceIssuers.has(c.issuer.trim().toLowerCase()),
  }));

  return { cards, error: null };
}

export async function loadCatalogCard(
  supabase: SupabaseClient,
  id: string,
): Promise<{ card: CatalogCardListItem | null; error: string | null }> {
  const [cardRes, pendingRes] = await Promise.all([
    supabase.from("cards").select(CARD_COLUMNS).eq("id", id).maybeSingle<CatalogCard>(),
    supabase
      .from("card_findings")
      .select("id")
      .eq("linked_card_id", id)
      .eq("review_status", "pending")
      .limit(1),
  ]);

  if (cardRes.error) return { card: null, error: "Could not load this card. Refresh to try again." };
  if (!cardRes.data) return { card: null, error: null };

  const c = cardRes.data;
  const { data: matchingSource } = await supabase
    .from("crawl_sources")
    .select("id")
    .ilike("issuer_name", c.issuer)
    .limit(1);

  return {
    card: {
      ...c,
      reward_categories: Array.isArray(c.reward_categories) ? c.reward_categories : [],
      pending_change: (pendingRes.data?.length ?? 0) > 0,
      has_crawl_source: (matchingSource?.length ?? 0) > 0,
    },
    error: null,
  };
}

/** Latest approved finding for source quotes (by reviewed_at, then created_at). */
export async function loadLatestApprovedExtraction(
  supabase: SupabaseClient,
  cardId: string,
): Promise<Extraction | null> {
  const { data } = await supabase
    .from("card_findings")
    .select("extracted, reviewed_at, created_at")
    .eq("linked_card_id", cardId)
    .eq("review_status", "approved")
    .order("reviewed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<(ApprovedFinding & { reviewed_at: string | null; created_at: string })[]>();
  return data?.[0]?.extracted ?? null;
}

export async function loadCardHistory(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ entries: CardAuditEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_audit")
    .select(CARD_AUDIT_COLUMNS)
    .eq("entity", "cards")
    .eq("entity_id", cardId)
    .order("at", { ascending: false })
    .limit(50)
    .returns<CardAuditEntry[]>();

  if (error) return { entries: [], error: "Could not load history." };
  return { entries: data ?? [], error: null };
}
