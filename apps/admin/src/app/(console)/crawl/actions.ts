"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { ALL_ACTIVE_SCOPE } from "@/lib/crawl/types";
import { isUuid } from "@/lib/sources/validation";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function failure(message: string): ActionResult {
  return { ok: false, message };
}

type SourcePick = { id: string; issuer_name: string; compare_url: string | null; status: string };

async function activeQueueBlocked(supabase: SupabaseClient, sourceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("crawl_runs")
    .select("id")
    .eq("source_id", sourceId)
    .in("status", ["requested", "running"])
    .limit(1);
  return Boolean(data && data.length > 0);
}

async function insertRequested(
  supabase: SupabaseClient,
  source: SourcePick,
  email: string,
): Promise<ActionResult> {
  const { error } = await supabase.from("crawl_runs").insert({
    source_id: source.id,
    source_scope: source.issuer_name,
    trigger: "manual",
    status: "requested",
    requested_by: email,
  });
  if (error) return failure(`Could not queue a crawl for ${source.issuer_name}. Try again.`);
  return {
    ok: true,
    message: `Queued a crawl for ${source.issuer_name}. The GitHub Actions crawler will pick it up.`,
  };
}

type LoadedSource = { ok: true; source: SourcePick } | { ok: false; message: string };

/** Active source with a compare URL, or a failure explaining why it can't be crawled. */
async function loadCrawlableSource(
  supabase: SupabaseClient,
  sourceId: string,
  missingMessage: string,
): Promise<LoadedSource> {
  const { data: source, error } = await supabase
    .from("crawl_sources")
    .select("id, issuer_name, compare_url, status")
    .eq("id", sourceId)
    .maybeSingle<SourcePick>();
  if (error || !source) return { ok: false, message: missingMessage };
  if (source.status !== "active" || !source.compare_url) {
    return {
      ok: false,
      message: `${source.issuer_name} must be active with a compare page before you can crawl it.`,
    };
  }
  if (await activeQueueBlocked(supabase, source.id)) {
    return {
      ok: false,
      message: `${source.issuer_name} already has a crawl requested or running.`,
    };
  }
  return { ok: true, source };
}

function revalidateCrawl() {
  revalidatePath("/crawl");
  revalidatePath("/review");
}

async function requestAllActive(supabase: SupabaseClient, email: string): Promise<ActionResult> {
  const { data: sources, error } = await supabase
    .from("crawl_sources")
    .select("id, issuer_name, compare_url, status")
    .eq("status", "active")
    .order("issuer_name")
    .returns<SourcePick[]>();
  if (error) return failure("Could not load active issuers. Try again.");
  const list = (sources ?? []).filter((s) => s.compare_url);
  if (list.length === 0) return failure("No active issuers with a compare page to crawl.");

  let queued = 0;
  let skipped = 0;
  for (const source of list) {
    if (await activeQueueBlocked(supabase, source.id)) {
      skipped++;
      continue;
    }
    const res = await insertRequested(supabase, source, email);
    if (!res.ok) return res;
    queued++;
  }
  if (queued === 0) {
    return failure(
      skipped > 0
        ? "Every active issuer already has a crawl requested or running."
        : "No active issuers with a compare page to crawl.",
    );
  }
  const skipNote = skipped > 0 ? ` Skipped ${skipped} already queued.` : "";
  return {
    ok: true,
    message: `Queued ${queued} crawl${queued === 1 ? "" : "s"}. The GitHub Actions crawler will pick ${queued === 1 ? "it" : "them"} up.${skipNote}`,
  };
}

async function requestOne(supabase: SupabaseClient, email: string, sourceId: string): Promise<ActionResult> {
  const loaded = await loadCrawlableSource(supabase, sourceId, "That issuer no longer exists.");
  if (!loaded.ok) return failure(loaded.message);
  return insertRequested(supabase, loaded.source, email);
}

/** Queue one issuer (or every active issuer) as crawl_runs status=requested. */
export async function requestCrawl(scope: string): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (typeof scope !== "string" || !scope.trim()) return failure("Choose what to crawl.");

  const { supabase, email } = auth;
  let result: ActionResult;
  if (scope === ALL_ACTIVE_SCOPE) {
    result = await requestAllActive(supabase, email);
  } else if (!isUuid(scope)) {
    result = failure("Choose what to crawl.");
  } else {
    result = await requestOne(supabase, email, scope);
  }

  if (result.ok) revalidateCrawl();
  return result;
}

/** Delete a still-requested run so the workflow never claims it. */
export async function cancelCrawlRequest(runId: string): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(runId)) return failure("That crawl request no longer exists.");
  const { supabase } = auth;

  const { data: run } = await supabase
    .from("crawl_runs")
    .select("id, source_scope, status")
    .eq("id", runId)
    .maybeSingle<{ id: string; source_scope: string; status: string }>();
  if (!run) return failure("That crawl request no longer exists.");
  if (run.status !== "requested") {
    return failure("Only a requested crawl can be cancelled. Check GitHub Actions if it already started.");
  }

  const { data: deleted, error } = await supabase
    .from("crawl_runs")
    .delete()
    .eq("id", runId)
    .eq("status", "requested")
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return failure(`Could not cancel the crawl for ${run.source_scope}. Refresh and try again.`);
  }
  revalidateCrawl();
  return { ok: true, message: `Cancelled the crawl request for ${run.source_scope}.` };
}

/** Queue another requested run from a finished (done/failed) run's scope. */
export async function retryCrawl(runId: string): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(runId)) return failure("That crawl no longer exists.");
  const { supabase, email } = auth;

  const { data: run } = await supabase
    .from("crawl_runs")
    .select("id, source_id, source_scope, status")
    .eq("id", runId)
    .maybeSingle<{ id: string; source_id: string | null; source_scope: string; status: string }>();
  if (!run) return failure("That crawl no longer exists.");
  if (run.status !== "done" && run.status !== "failed") {
    return failure("Only a finished crawl can be retried.");
  }
  if (!run.source_id) return failure(`Could not retry ${run.source_scope}: the source is missing.`);

  const loaded = await loadCrawlableSource(
    supabase,
    run.source_id,
    `Could not retry ${run.source_scope}: the issuer is gone.`,
  );
  if (!loaded.ok) return failure(loaded.message);

  const res = await insertRequested(supabase, loaded.source, email);
  if (!res.ok) return res;
  revalidateCrawl();
  return {
    ok: true,
    message: `Queued another crawl for ${loaded.source.issuer_name}. The GitHub Actions crawler will pick it up.`,
  };
}
