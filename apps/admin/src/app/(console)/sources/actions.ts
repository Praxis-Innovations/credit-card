"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { checkRobotsTxt } from "@/lib/sources/robots";
import { CRAWL_SOURCE_COLUMNS, type CrawlSource, type SourceStatus } from "@/lib/sources/types";
import {
  isUuid,
  readSourceForm,
  validateCompareUrl,
  validateSourceInput,
  type FieldErrors,
} from "@/lib/sources/validation";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

const UNIQUE_VIOLATION = "23505";

function failure(message: string, fieldErrors?: FieldErrors): ActionResult {
  return { ok: false, message, fieldErrors };
}

/** Create (no `id`) or update an issuer. Sources edits need the admin role. */
export async function saveSource(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  const { supabase } = auth;

  const rawId = formData.get("id");
  const id = rawId === null || rawId === "" ? null : rawId;
  if (id !== null && !isUuid(id)) return failure("That issuer no longer exists.");

  const parsed = validateSourceInput(readSourceForm(formData));
  if (!parsed.ok) return failure("Check the highlighted fields.", parsed.fieldErrors);
  const input = parsed.data;

  let duplicateQuery = supabase.from("crawl_sources").select("id").eq("issuer_name", input.issuer_name);
  if (id) duplicateQuery = duplicateQuery.neq("id", id);
  const { data: duplicates, error: dupError } = await duplicateQuery.limit(1);
  if (dupError) return failure("Could not check the issuer name. Try again.");
  if (duplicates && duplicates.length > 0) {
    return failure("Check the highlighted fields.", {
      issuer_name: `${input.issuer_name} is already on the list.`,
    });
  }

  if (id === null) {
    const { error } = await supabase
      .from("crawl_sources")
      .insert({ ...input, status: input.compare_url ? "active" : "not_set_up" });
    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? failure("Check the highlighted fields.", { issuer_name: `${input.issuer_name} is already on the list.` })
        : failure("Could not add the issuer. Try again.");
    }
    revalidatePath("/sources");
    return { ok: true, message: `Added ${input.issuer_name}.` };
  }

  const { data: existing, error: readError } = await supabase
    .from("crawl_sources")
    .select(CRAWL_SOURCE_COLUMNS)
    .eq("id", id)
    .maybeSingle<CrawlSource>();
  if (readError || !existing) return failure("That issuer no longer exists.");

  let status: SourceStatus = existing.status;
  if (!input.compare_url) status = "not_set_up";
  else if (existing.status === "not_set_up") status = "active";

  const urlChanged = input.compare_url !== existing.compare_url;
  const { data: updated, error } = await supabase
    .from("crawl_sources")
    .update({
      ...input,
      status,
      ...(urlChanged ? { robots_status: null, robots_checked_at: null } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    return error.code === UNIQUE_VIOLATION
      ? failure("Check the highlighted fields.", { issuer_name: `${input.issuer_name} is already on the list.` })
      : failure("Could not save the issuer. Try again.");
  }
  if (!updated || updated.length === 0) return failure("Your role can't make this change.");
  revalidatePath("/sources");
  return { ok: true, message: `Saved ${input.issuer_name}.` };
}

/** Pause an active or blocked issuer, or resume a paused one. */
export async function setSourcePaused(id: string, paused: boolean): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id) || typeof paused !== "boolean") return failure("That issuer no longer exists.");
  const { supabase } = auth;

  const { data: source } = await supabase
    .from("crawl_sources")
    .select("id, issuer_name, compare_url, status")
    .eq("id", id)
    .maybeSingle<Pick<CrawlSource, "id" | "issuer_name" | "compare_url" | "status">>();
  if (!source) return failure("That issuer no longer exists.");

  let next: SourceStatus;
  if (paused) {
    if (source.status !== "active" && source.status !== "blocked") {
      return failure(`${source.issuer_name} can't be paused right now.`);
    }
    next = "paused";
  } else {
    if (source.status !== "paused") return failure(`${source.issuer_name} isn't paused.`);
    next = source.compare_url ? "active" : "not_set_up";
  }

  const { data: updated, error } = await supabase
    .from("crawl_sources")
    .update({ status: next })
    .eq("id", id)
    .eq("status", source.status)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return failure(`Could not ${paused ? "pause" : "resume"} ${source.issuer_name}. Refresh and try again.`);
  }
  revalidatePath("/sources");
  return { ok: true, message: `${paused ? "Paused" : "Resumed"} ${source.issuer_name}.` };
}

/** Fetch the compare URL's robots.txt server-side and store whether it's allowed. */
export async function checkSourceRobots(id: string): Promise<ActionResult> {
  const auth = await authorizeMutation("admin");
  if (!auth.ok) return failure(auth.message);
  if (!isUuid(id)) return failure("That issuer no longer exists.");
  const { supabase } = auth;

  const { data: source } = await supabase
    .from("crawl_sources")
    .select("id, issuer_name, compare_url")
    .eq("id", id)
    .maybeSingle<Pick<CrawlSource, "id" | "issuer_name" | "compare_url">>();
  if (!source) return failure("That issuer no longer exists.");
  if (!source.compare_url) return failure(`Add a compare page URL for ${source.issuer_name} first.`);

  const urlCheck = validateCompareUrl(source.compare_url, source.issuer_name);
  if (!urlCheck.ok) return failure(`${source.issuer_name}'s compare URL is invalid: ${urlCheck.error}`);

  const result = await checkRobotsTxt(urlCheck.url);
  const { data: updated, error } = await supabase
    .from("crawl_sources")
    .update({ robots_status: result.status, robots_checked_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return failure(`Checked robots.txt but could not save the result for ${source.issuer_name}.`);
  }
  revalidatePath("/sources");
  return {
    ok: result.status !== "unreachable",
    message: `${source.issuer_name}: ${result.detail}`,
  };
}
