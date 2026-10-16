"use server";

import { revalidatePath } from "next/cache";
import { authorizeMutation } from "@/lib/auth/guard";
import { CRAWL_SOURCE_COLUMNS, type CrawlSource, type SourceStatus } from "@/lib/sources/types";
import {
  isUuid,
  readSourceForm,
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
    const { error } = await supabase.from("crawl_sources").insert({
      issuer_name: input.issuer_name,
      compare_url: input.compare_url,
      status: input.compare_url ? "active" : "not_set_up",
    });
    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? failure("Check the highlighted fields.", { issuer_name: `${input.issuer_name} is already on the list.` })
        : failure("Could not add the issuer. Try again.");
    }
    revalidatePath("/sources");
    revalidatePath("/crawl");
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
      issuer_name: input.issuer_name,
      compare_url: input.compare_url,
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
  revalidatePath("/crawl");
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
  revalidatePath("/crawl");
  return { ok: true, message: `${paused ? "Paused" : "Resumed"} ${source.issuer_name}.` };
}
