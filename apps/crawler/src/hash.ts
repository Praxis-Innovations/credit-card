import { createHash } from "node:crypto";

/** Hash of the cleaned page text, so markup churn (ids, scripts, ads) does not trigger re-extraction. */
export function contentHash(cleanedText: string): string {
  const normalised = cleanedText.replace(/\s+/g, " ").trim();
  return `sha256:${createHash("sha256").update(normalised, "utf8").digest("hex")}`;
}
