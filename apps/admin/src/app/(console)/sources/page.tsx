import type { Metadata } from "next";
import { SourcesConsole } from "@/components/sources/sources-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import {
  CRAWL_SOURCE_COLUMNS,
  type CrawlSource,
  type DiscoveredCardUrl,
  type SourceRow,
} from "@/lib/sources/types";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const { supabase, role } = await requireConsoleSession();

  const [sourcesRes, urlsRes, cardsRes] = await Promise.all([
    supabase.from("crawl_sources").select(CRAWL_SOURCE_COLUMNS).order("issuer_name").returns<CrawlSource[]>(),
    supabase
      .from("discovered_card_urls")
      .select(
        "id, source_id, card_name, product_url, first_seen_at, last_fetched_at, http_status, linked_card_id, included",
      )
      .order("card_name")
      .returns<DiscoveredCardUrl[]>(),
    supabase.from("cards").select("issuer").returns<{ issuer: string }[]>(),
  ]);

  const urlsBySource = new Map<string, DiscoveredCardUrl[]>();
  for (const url of urlsRes.data ?? []) {
    urlsBySource.set(url.source_id, [...(urlsBySource.get(url.source_id) ?? []), url]);
  }
  const catalogByIssuer = new Map<string, number>();
  for (const { issuer } of cardsRes.data ?? []) {
    const key = issuer.toLowerCase();
    catalogByIssuer.set(key, (catalogByIssuer.get(key) ?? 0) + 1);
  }

  const rows: SourceRow[] = (sourcesRes.data ?? []).map((s) => ({
    ...s,
    urls: urlsBySource.get(s.id) ?? [],
    catalogCount: catalogByIssuer.get(s.issuer_name.toLowerCase()) ?? 0,
  }));

  return (
    <SourcesConsole
      sources={rows}
      canEdit={hasRole(role, "admin")}
      loadError={sourcesRes.error ? "Could not load the issuer list. Refresh to try again." : null}
    />
  );
}
