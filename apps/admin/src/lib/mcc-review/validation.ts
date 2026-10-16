import { MAX_REVIEW_NOTE } from "./types";
import { isUuid } from "@/lib/sources/validation";

/** A rejection must say why. Bulk approve may also carry a shared reason. */
export function validateReviewNote(
  raw: unknown,
  { required }: { required: boolean },
): { ok: true; note: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    if (required) return { ok: false, error: "Give a reason." };
    return { ok: true, note: null };
  }
  if (typeof raw !== "string") return { ok: false, error: "Give a reason." };
  const note = raw.trim();
  if (note.length > MAX_REVIEW_NOTE) {
    return { ok: false, error: `Keep the reason under ${MAX_REVIEW_NOTE} characters.` };
  }
  return { ok: true, note };
}

export function validateFindingIds(
  raw: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Select at least one finding." };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !isUuid(item)) {
      return { ok: false, error: "One of the selected findings is invalid." };
    }
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return { ok: true, ids };
}
