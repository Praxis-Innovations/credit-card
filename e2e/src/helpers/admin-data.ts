import { createServiceClient, signInAs } from "./supabase";

/** Admin tables that must stay empty for a normal app JWT under RLS. */
export const ADMIN_DATA_TABLES = [
  "admin_users",
  "admin_audit",
  "crawl_sources",
  "discovered_card_urls",
  "crawl_runs",
  "card_findings",
] as const;

export type AdminDataTable = (typeof ADMIN_DATA_TABLES)[number];

/** Fixed local-only UUIDs for review-queue fixtures (seeded via service role). */
const E2E_REVIEW = {
  runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  approveFindingId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  rejectFindingId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  discoveredUrlId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
} as const;

const APPROVE_CARD = "E2E Approve Card";
const REJECT_CARD = "E2E Reject Card";

/**
 * Ensure two pending findings exist for Review approve / reject-with-reason.
 * Uses the service role (local Docker only) — never the shared hosted project.
 */
export async function ensureReviewFixtures(): Promise<{
  approveName: string;
  rejectName: string;
}> {
  const service = createServiceClient();

  const { data: source, error: sourceError } = await service
    .from("crawl_sources")
    .select("id")
    .eq("issuer_name", "Scotiabank")
    .maybeSingle<{ id: string }>();
  if (sourceError || !source) {
    throw new Error(`Scotiabank source missing for review fixtures: ${sourceError?.message ?? "not found"}`);
  }

  const { error: delFindingsError } = await service.from("card_findings").delete().in("id", [
    E2E_REVIEW.approveFindingId,
    E2E_REVIEW.rejectFindingId,
  ]);
  if (delFindingsError) {
    throw new Error(`Failed to clear card_findings fixtures: ${delFindingsError.message}`);
  }
  const { error: delRunError } = await service.from("crawl_runs").delete().eq("id", E2E_REVIEW.runId);
  if (delRunError) {
    throw new Error(`Failed to clear crawl_runs fixture: ${delRunError.message}`);
  }
  const { error: delCardError } = await service.from("cards").delete().eq("id", "scotiabank-e2e-approve-card");
  if (delCardError) {
    throw new Error(`Failed to clear e2e catalog card: ${delCardError.message}`);
  }

  const { error: runError } = await service.from("crawl_runs").insert({
    id: E2E_REVIEW.runId,
    source_id: source.id,
    source_scope: "Scotiabank",
    trigger: "cli",
    status: "done",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });
  if (runError) {
    throw new Error(`Failed to seed crawl_runs fixture: ${runError.message}`);
  }

  const extracted = {
    annual_fee: { value: 120, quote: "$120" },
    card_name: { value: APPROVE_CARD, quote: APPROVE_CARD },
  };
  const checkResults = {
    ok: true,
    total: 1,
    flagged: 0,
    fields: [
      {
        field: "annual_fee",
        quote_found: true,
        value_in_quote: true,
        in_range: true,
        ok: true,
        issues: [],
      },
    ],
  };

  const { error: findingsError } = await service.from("card_findings").insert([
    {
      id: E2E_REVIEW.approveFindingId,
      run_id: E2E_REVIEW.runId,
      source_id: source.id,
      product_url:
        "https://www.scotiabank.com/ca/en/personal/credit-cards/e2e-approve.html",
      card_name: APPROVE_CARD,
      extracted,
      check_results: checkResults,
      flagged_count: 0,
      diff_kind: "new",
      review_status: "pending",
    },
    {
      id: E2E_REVIEW.rejectFindingId,
      run_id: E2E_REVIEW.runId,
      source_id: source.id,
      product_url:
        "https://www.scotiabank.com/ca/en/personal/credit-cards/e2e-reject.html",
      card_name: REJECT_CARD,
      extracted: {
        ...extracted,
        card_name: { value: REJECT_CARD, quote: REJECT_CARD },
      },
      check_results: checkResults,
      flagged_count: 0,
      diff_kind: "changed",
      diff: {
        kind: "changed",
        linked_card_id: null,
        match: null,
        changes: [
          {
            field: "annual_fee",
            catalog: 99,
            extracted: 120,
            flagged: false,
          },
        ],
      },
      review_status: "pending",
    },
  ]);
  if (findingsError) {
    throw new Error(`Failed to seed card_findings fixtures: ${findingsError.message}`);
  }

  return { approveName: APPROVE_CARD, rejectName: REJECT_CARD };
}

/** Delete the fixed review-queue fixtures (findings + run + card created by approve). */
export async function cleanupReviewFixtures(): Promise<void> {
  const service = createServiceClient();
  const { error: delFindingsError } = await service.from("card_findings").delete().in("id", [
    E2E_REVIEW.approveFindingId,
    E2E_REVIEW.rejectFindingId,
  ]);
  if (delFindingsError) {
    throw new Error(`Failed to cleanup card_findings fixtures: ${delFindingsError.message}`);
  }
  const { error: delRunError } = await service.from("crawl_runs").delete().eq("id", E2E_REVIEW.runId);
  if (delRunError) {
    throw new Error(`Failed to cleanup crawl_runs fixture: ${delRunError.message}`);
  }
  // Approve of the "new" E2E card inserts a verified catalog row (AD2).
  const { error: delCardError } = await service.from("cards").delete().eq("id", "scotiabank-e2e-approve-card");
  if (delCardError) {
    throw new Error(`Failed to cleanup e2e catalog card: ${delCardError.message}`);
  }
}

/** Remove a test issuer created by Sources E2E (service role). */
export async function deleteIssuerByName(issuerName: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("crawl_sources").delete().eq("issuer_name", issuerName);
  if (error) {
    throw new Error(`Failed to delete issuer ${issuerName}: ${error.message}`);
  }
}

/**
 * Seed enough admin rows that an RLS "zero rows" assertion is meaningful.
 * Reuses review fixtures (crawl_runs / card_findings) and adds a discovered
 * URL plus a crawl_sources touch so admin_audit gets a trigger row.
 */
export async function ensureAdminRlsFixtures(): Promise<void> {
  await ensureReviewFixtures();
  const service = createServiceClient();

  const { data: source, error: sourceError } = await service
    .from("crawl_sources")
    .select("id")
    .eq("issuer_name", "Scotiabank")
    .maybeSingle<{ id: string }>();
  if (sourceError || !source) {
    throw new Error(`Scotiabank source missing for RLS fixtures: ${sourceError?.message ?? "not found"}`);
  }

  const { error: delUrlError } = await service
    .from("discovered_card_urls")
    .delete()
    .eq("id", E2E_REVIEW.discoveredUrlId);
  if (delUrlError) {
    throw new Error(`Failed to clear discovered_card_urls fixture: ${delUrlError.message}`);
  }
  const { error: urlError } = await service.from("discovered_card_urls").insert({
    id: E2E_REVIEW.discoveredUrlId,
    source_id: source.id,
    card_name: "E2E Discovered Card",
    product_url:
      "https://www.scotiabank.com/ca/en/personal/credit-cards/e2e-discovered.html",
  });
  if (urlError) {
    throw new Error(`Failed to seed discovered_card_urls: ${urlError.message}`);
  }

  // Seed insert of Scotiabank ran before the audit trigger; poke notes so
  // admin_audit has at least one row for the service-role visibility check.
  const { error: touchError } = await service
    .from("crawl_sources")
    .update({ notes: "e2e rls probe" })
    .eq("id", source.id);
  if (touchError) {
    throw new Error(`Failed to touch crawl_sources for admin_audit: ${touchError.message}`);
  }
}

/** Remove RLS probe rows and restore the Scotiabank notes column. */
export async function cleanupAdminRlsFixtures(): Promise<void> {
  const service = createServiceClient();
  const { error: delUrlError } = await service
    .from("discovered_card_urls")
    .delete()
    .eq("id", E2E_REVIEW.discoveredUrlId);
  if (delUrlError) {
    throw new Error(`Failed to cleanup discovered_card_urls: ${delUrlError.message}`);
  }
  await cleanupReviewFixtures();
  const { error: restoreError } = await service
    .from("crawl_sources")
    .update({ notes: null })
    .eq("issuer_name", "Scotiabank");
  if (restoreError) {
    throw new Error(`Failed to restore Scotiabank notes: ${restoreError.message}`);
  }
}

/** Count rows visible to the seeded app user under RLS. */
export async function countAsAppUser(table: AdminDataTable): Promise<number> {
  const { client } = await signInAs("app");
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`App-user count on ${table} failed: ${error.message}`);
  }
  return count ?? 0;
}

/** Count rows visible to the local service role (bypasses RLS). */
export async function countAsServiceRole(table: AdminDataTable): Promise<number> {
  const service = createServiceClient();
  const { count, error } = await service.from(table).select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`Service-role count on ${table} failed: ${error.message}`);
  }
  return count ?? 0;
}

export async function appUserAdminRole(): Promise<{
  isAdmin: boolean;
  role: string | null;
}> {
  const { client } = await signInAs("app");
  const [adminRes, roleRes] = await Promise.all([
    client.rpc("is_admin", { min_role: "viewer" }),
    client.rpc("current_admin_role"),
  ]);
  if (adminRes.error) {
    throw new Error(`is_admin RPC failed: ${adminRes.error.message}`);
  }
  if (roleRes.error) {
    throw new Error(`current_admin_role RPC failed: ${roleRes.error.message}`);
  }
  return {
    isAdmin: Boolean(adminRes.data),
    role: (roleRes.data as string | null) ?? null,
  };
}
