import type { Metadata } from "next";
import { SourcesConsole } from "@/components/sources/sources-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { CRAWL_SOURCE_COLUMNS, type CrawlSource } from "@/lib/sources/types";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const { supabase, role } = await requireConsoleSession();

  const sourcesRes = await supabase
    .from("crawl_sources")
    .select(CRAWL_SOURCE_COLUMNS)
    .order("issuer_name")
    .returns<CrawlSource[]>();

  return (
    <SourcesConsole
      sources={sourcesRes.data ?? []}
      canEdit={hasRole(role, "admin")}
      loadError={sourcesRes.error ? "Could not load the issuer list. Refresh to try again." : null}
    />
  );
}
