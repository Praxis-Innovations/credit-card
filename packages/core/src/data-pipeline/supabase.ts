import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CatalogStatus, CatalogTable } from "./types";
import type { ReviewDecision } from "./decisions";

export function createServiceClient(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (env / Actions secrets — never commit keys).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function tryCreateServiceClient(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient | null {
  try {
    return createServiceClient(env);
  } catch {
    return null;
  }
}

export interface CatalogSourceRow {
  table: CatalogTable;
  id: string;
  sourceUrl: string;
  /** Short claim tokens that should still appear on the page. */
  claims: string[];
  status: CatalogStatus;
}

/** Load verified catalog rows that have source URLs for health checks. */
export async function loadVerifiedSourceRows(
  client: SupabaseClient,
): Promise<CatalogSourceRow[]> {
  const rows: CatalogSourceRow[] = [];

  const brands = await client
    .from("merchant_brands")
    .select("id, name, source_url, status")
    .eq("status", "verified");
  if (brands.error) throw brands.error;
  for (const r of brands.data ?? []) {
    rows.push({
      table: "merchant_brands",
      id: r.id as string,
      sourceUrl: r.source_url as string,
      claims: [r.name as string],
      status: "verified",
    });
  }

  const programs = await client
    .from("loyalty_programs")
    .select("id, name, source_url, status")
    .eq("status", "verified");
  if (programs.error) throw programs.error;
  for (const r of programs.data ?? []) {
    rows.push({
      table: "loyalty_programs",
      id: r.id as string,
      sourceUrl: r.source_url as string,
      claims: [r.name as string],
      status: "verified",
    });
  }

  const partnerships = await client
    .from("merchant_partnerships")
    .select("id, benefits, source_urls, status, notes")
    .eq("status", "verified");
  if (partnerships.error) throw partnerships.error;
  for (const r of partnerships.data ?? []) {
    const urls = (r.source_urls as string[]) ?? [];
    const benefits = (r.benefits as Array<{ amount?: number; summary?: string }>) ?? [];
    const claims = [
      ...benefits.map((b) => String(b.amount ?? "")).filter(Boolean),
      ...benefits.map((b) => b.summary ?? "").filter(Boolean),
      (r.notes as string | null) ?? "",
    ].filter(Boolean);
    for (const url of urls) {
      rows.push({
        table: "merchant_partnerships",
        id: r.id as string,
        sourceUrl: url,
        claims,
        status: "verified",
      });
    }
  }

  return rows;
}

export async function markCatalogStatus(input: {
  client: SupabaseClient;
  table: CatalogTable;
  id: string;
  status: CatalogStatus;
  reviewedBy: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    reviewed_by: input.reviewedBy,
  };
  if (input.status === "verified") {
    patch.verified_at = new Date().toISOString();
    patch.last_verified = new Date().toISOString().slice(0, 10);
  }
  const { error } = await input.client
    .from(input.table)
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function upsertReviewDecisionRemote(
  client: SupabaseClient,
  decision: ReviewDecision,
): Promise<void> {
  const { error } = await client.from("pipeline_review_decisions").upsert(
    {
      fingerprint: decision.fingerprint,
      finding_kind: decision.findingKind,
      issuer: decision.issuer ?? null,
      subject: decision.subject ?? null,
      staging_value: decision.stagingValue ?? null,
      production_value: decision.productionValue ?? null,
      status: decision.status,
      reason: decision.reason ?? null,
      reviewed_by: decision.reviewedBy,
      reviewed_at: decision.reviewedAt,
      source_urls: decision.sourceUrls ?? [],
      captured_at: decision.reviewedAt,
    },
    { onConflict: "fingerprint" },
  );
  if (error) throw error;
}

export async function loadRejectedFingerprintsRemote(
  client: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("pipeline_review_decisions")
    .select("fingerprint")
    .eq("status", "rejected");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.fingerprint as string));
}
