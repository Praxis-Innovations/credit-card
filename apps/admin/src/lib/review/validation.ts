import { MAX_REVIEW_NOTE } from "./types";

/** A rejection must say why. Returns the trimmed reason or an error message. */
export function validateRejectReason(
  raw: unknown,
): { ok: true; reason: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, error: "Give a reason for rejecting." };
  const reason = raw.trim();
  if (reason.length > MAX_REVIEW_NOTE) {
    return { ok: false, error: `Keep the reason under ${MAX_REVIEW_NOTE} characters.` };
  }
  return { ok: true, reason };
}
