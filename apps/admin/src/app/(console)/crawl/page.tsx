import type { Metadata } from "next";
import { CrawlConsole } from "@/components/crawl/crawl-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { CRAWL_RUN_COLUMNS, type CrawlRun } from "@/lib/crawl/types";

export const metadata: Metadata = { title: "Crawl" };

type ScopeSource = { id: string; issuer_name: string };

export default async function CrawlPage() {
  const { supabase, role } = await requireConsoleSession();

  const [sourcesRes, latestRes] = await Promise.all([
    supabase
      .from("crawl_sources")
      .select("id, issuer_name")
      .eq("status", "active")
      .not("compare_url", "is", null)
      .order("issuer_name")
      .returns<ScopeSource[]>(),
    supabase
      .from("crawl_runs")
      .select(CRAWL_RUN_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<CrawlRun>(),
  ]);

  const loadError =
    sourcesRes.error || latestRes.error
      ? "Could not load crawl status. Refresh to try again."
      : null;

  return (
    <CrawlConsole
      sources={sourcesRes.data ?? []}
      latest={latestRes.data ?? null}
      canEdit={hasRole(role, "admin")}
      loadError={loadError}
    />
  );
}
