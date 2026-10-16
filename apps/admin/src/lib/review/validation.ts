import { MAX_FIELD_VALUE, MAX_REVIEW_NOTE, type FieldDecision, type ReviewFields } from "./types";

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

function asString(raw: unknown, label: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: `Each field needs a ${label}.` };
  if (raw.length > MAX_FIELD_VALUE) {
    return { ok: false, error: `Keep each field value under ${MAX_FIELD_VALUE} characters.` };
  }
  return { ok: true, value: raw };
}

/**
 * Field decisions sent with Approve. Keys must be unique; every row carries
 * the page value and the (possibly edited) final value.
 */
export function validateReviewFields(
  raw: unknown,
  allowedKeys: ReadonlySet<string>,
): { ok: true; fields: ReviewFields } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Field decisions are missing." };
  }
  const fieldsRaw = (raw as { fields?: unknown }).fields;
  if (!Array.isArray(fieldsRaw)) return { ok: false, error: "Field decisions are missing." };

  const seen = new Set<string>();
  const fields: FieldDecision[] = [];

  for (const item of fieldsRaw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Each field decision is invalid." };
    }
    const row = item as Record<string, unknown>;
    if (typeof row.key !== "string" || row.key.trim() === "") {
      return { ok: false, error: "Each field needs a key." };
    }
    const key = row.key;
    if (!allowedKeys.has(key)) return { ok: false, error: `Unknown field: ${key}.` };
    if (seen.has(key)) return { ok: false, error: `Duplicate field: ${key}.` };
    if (typeof row.save !== "boolean") return { ok: false, error: "Each field needs a save choice." };

    const page = asString(row.page_value, "page value");
    if (!page.ok) return page;
    const value = asString(row.value, "value");
    if (!value.ok) return value;

    seen.add(key);
    fields.push({ key, save: row.save, page_value: page.value, value: value.value });
  }

  if (allowedKeys.size > 0 && seen.size !== allowedKeys.size) {
    return { ok: false, error: "Decide every field before approving." };
  }

  return { ok: true, fields: { fields } };
}
