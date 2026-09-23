import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decisionFromFinding,
  loadReviewDecisions,
  saveReviewDecisions,
  upsertDecision,
  type ReviewDecision,
} from "./decisions";
import type { DiffFinding, DiffReport } from "./types";
import type { CatalogStatus, CatalogTable } from "./types";
import {
  createServiceClient,
  markCatalogStatus,
  upsertReviewDecisionRemote,
} from "./supabase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Approvals file format (never contains secrets):
 * {
 *   "reviewer": "github:login",
 *   "decisions": [
 *     { "fingerprint": "...", "action": "reject", "reason": "marketing total" },
 *     { "fingerprint": "...", "action": "promote", "table": "cards", "id": "…", "row": { ... } },
 *     { "table": "merchant_partnerships", "id": "…", "action": "stale" }
 *   ]
 * }
 */
export interface PromoteDecision {
  action: "promote" | "reject" | "stale";
  fingerprint?: string;
  reason?: string;
  table?: CatalogTable;
  id?: string;
  /** Full or partial row for upsert on promote (snake_case DB columns). */
  row?: Record<string, unknown>;
}

export interface PromoteFile {
  reviewer: string;
  decisions: PromoteDecision[];
}

export interface PromoteResult {
  reviewer: string;
  applied: Array<{ action: string; detail: string }>;
  localDecisionsPath: string;
}

export async function loadPromoteFile(filePath: string): Promise<PromoteFile> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as PromoteFile;
  if (!parsed.reviewer || !Array.isArray(parsed.decisions)) {
    throw new Error("approvals file requires reviewer + decisions[]");
  }
  return parsed;
}

export async function applyPromotions(
  file: PromoteFile,
  options?: {
    report?: DiffReport;
    decisionsPath?: string;
    dryRun?: boolean;
  },
): Promise<PromoteResult> {
  const client = options?.dryRun ? null : createServiceClient();
  const decisionsPath =
    options?.decisionsPath ??
    path.join(__dirname, "state", "review-decisions.json");
  let store = await loadReviewDecisions(decisionsPath);
  const findingsByFp = new Map(
    (options?.report?.findings ?? []).map((f) => [f.fingerprint, f]),
  );
  const applied: PromoteResult["applied"] = [];
  const now = new Date().toISOString();

  for (const d of file.decisions) {
    if (d.action === "reject") {
      const finding = d.fingerprint
        ? findingsByFp.get(d.fingerprint)
        : undefined;
      const decision: ReviewDecision = finding
        ? decisionFromFinding(finding, "rejected", file.reviewer, d.reason)
        : {
            fingerprint: d.fingerprint ?? `manual-${now}`,
            findingKind: "suppressed_rejected",
            status: "rejected",
            reason: d.reason,
            reviewedBy: file.reviewer,
            reviewedAt: now,
          };
      store = upsertDecision(store, decision);
      if (client) await upsertReviewDecisionRemote(client, decision);
      applied.push({
        action: "reject",
        detail: `${decision.fingerprint}${d.reason ? ` (${d.reason})` : ""}`,
      });
      continue;
    }

    if (d.action === "stale") {
      if (!d.table || !d.id) {
        throw new Error("stale action requires table + id");
      }
      if (client) {
        await markCatalogStatus({
          client,
          table: d.table,
          id: d.id,
          status: "stale",
          reviewedBy: file.reviewer,
        });
      }
      applied.push({
        action: options?.dryRun ? "stale(dry-run)" : "stale",
        detail: `${d.table}/${d.id}`,
      });
      continue;
    }

    if (d.action === "promote") {
      if (!d.table || !d.id) {
        throw new Error("promote action requires table + id");
      }
      if (!d.row) {
        throw new Error(
          `promote of ${d.table}/${d.id} requires row object (snake_case columns)`,
        );
      }
      const row = {
        ...d.row,
        id: d.id,
        status: "verified" satisfies CatalogStatus,
        verified_at: now,
        reviewed_by: file.reviewer,
        captured_at: (d.row.captured_at as string | undefined) ?? now,
        last_verified:
          (d.row.last_verified as string | undefined) ?? now.slice(0, 10),
      };
      if (client) {
        const { error } = await client.from(d.table).upsert(row, {
          onConflict: "id",
        });
        if (error) throw error;
      }
      if (d.fingerprint) {
        const finding = findingsByFp.get(d.fingerprint);
        const decision: ReviewDecision = finding
          ? decisionFromFinding(finding, "verified", file.reviewer, d.reason)
          : {
              fingerprint: d.fingerprint,
              findingKind: "unchanged_signal",
              status: "verified",
              reason: d.reason,
              reviewedBy: file.reviewer,
              reviewedAt: now,
            };
        store = upsertDecision(store, decision);
        if (client) await upsertReviewDecisionRemote(client, decision);
      }
      applied.push({
        action: options?.dryRun ? "promote(dry-run)" : "promote",
        detail: `${d.table}/${d.id}`,
      });
    }
  }

  // Always persist local decision fingerprints (including dry-run) so reviewers
  // can suppress re-flags without Supabase. Supabase writes happen only when client is set.
  await saveReviewDecisions(store, decisionsPath);

  return { reviewer: file.reviewer, applied, localDecisionsPath: decisionsPath };
}

/** Resolve a finding from latest report JSON for CLI convenience. */
export function findingByFingerprint(
  report: DiffReport,
  fingerprint: string,
): DiffFinding | undefined {
  return report.findings.find((f) => f.fingerprint === fingerprint);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const dry = args.includes("--dry-run");
  if (fileIdx < 0 || !args[fileIdx + 1]) {
    console.error(
      "Usage: tsx src/data-pipeline/promote.ts --file approvals.json [--dry-run]",
    );
    process.exitCode = 1;
    return;
  }
  const filePath = args[fileIdx + 1]!;
  const file = await loadPromoteFile(filePath);

  let report: DiffReport | undefined;
  try {
    const raw = await readFile(
      path.join(__dirname, "reports", "latest.json"),
      "utf8",
    );
    report = JSON.parse(raw) as DiffReport;
  } catch {
    // optional
  }

  const result = await applyPromotions(file, { report, dryRun: dry });
  console.log(
    JSON.stringify(
      { reviewer: result.reviewer, applied: result.applied, dryRun: dry },
      null,
      2,
    ),
  );
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
