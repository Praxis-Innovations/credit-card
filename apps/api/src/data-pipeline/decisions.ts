import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CatalogStatus,
  DiffChangeKind,
  DiffFinding,
} from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ReviewDecision {
  fingerprint: string;
  findingKind: DiffChangeKind | string;
  issuer?: string;
  subject?: string;
  stagingValue?: string;
  productionValue?: string;
  status: CatalogStatus;
  reason?: string;
  reviewedBy: string;
  reviewedAt: string;
  sourceUrls?: string[];
}

export interface ReviewDecisionStore {
  updatedAt: string;
  decisions: ReviewDecision[];
}

export function findingFingerprint(parts: {
  kind: string;
  issuer: string;
  subject: string;
  productionValue?: string;
  stagingValue?: string;
}): string {
  const key = [
    parts.kind,
    parts.issuer,
    parts.subject,
    parts.productionValue ?? "",
    parts.stagingValue ?? "",
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 20);
}

export function defaultDecisionsPath(): string {
  return path.join(__dirname, "state", "review-decisions.json");
}

export async function loadReviewDecisions(
  filePath = defaultDecisionsPath(),
): Promise<ReviewDecisionStore> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as ReviewDecisionStore;
  } catch {
    return { updatedAt: new Date(0).toISOString(), decisions: [] };
  }
}

export async function saveReviewDecisions(
  store: ReviewDecisionStore,
  filePath = defaultDecisionsPath(),
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  store.updatedAt = new Date().toISOString();
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function rejectedFingerprints(
  store: ReviewDecisionStore,
): Set<string> {
  return new Set(
    store.decisions
      .filter((d) => d.status === "rejected")
      .map((d) => d.fingerprint),
  );
}

export function upsertDecision(
  store: ReviewDecisionStore,
  decision: ReviewDecision,
): ReviewDecisionStore {
  const rest = store.decisions.filter((d) => d.fingerprint !== decision.fingerprint);
  return {
    updatedAt: new Date().toISOString(),
    decisions: [...rest, decision],
  };
}

export function decisionFromFinding(
  finding: DiffFinding,
  status: CatalogStatus,
  reviewedBy: string,
  reason?: string,
): ReviewDecision {
  return {
    fingerprint: finding.fingerprint,
    findingKind: finding.kind,
    issuer: finding.issuer,
    subject: finding.subject,
    stagingValue: finding.stagingValue,
    productionValue: finding.productionValue,
    status,
    reason,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    sourceUrls: finding.sourceUrls,
  };
}
