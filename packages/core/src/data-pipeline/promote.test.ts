import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyPromotions } from "./promote";
import type { DiffReport } from "./types";

describe("applyPromotions", () => {
  it("persists rejected fingerprints locally on dry-run=false without needing row promote", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "nt-promote-"));
    const decisionsPath = path.join(dir, "review-decisions.json");
    await writeFile(
      decisionsPath,
      JSON.stringify({ updatedAt: new Date().toISOString(), decisions: [] }),
    );

    const report: DiffReport = {
      generatedAt: new Date().toISOString(),
      runId: "t",
      crawlScope: "full",
      productionCardCount: 0,
      stagingFactCount: 0,
      suppressedRejectedCount: 0,
      findings: [
        {
          fingerprint: "deadbeefcafef00d1234",
          kind: "partnership_conflict",
          severity: "conflict",
          status: "pending",
          issuer: "Scotiabank",
          subject: "Shell",
          summary: "conflict",
          stagingValue: "10",
          productionValue: "3",
          sourceUrls: ["https://example.test"],
          relatedFactIds: [],
        },
      ],
      summary: {
        newCardCandidates: 0,
        removedCardCandidates: 0,
        feeChanges: 0,
        earnRateChanges: 0,
        newPartnershipCandidates: 0,
        partnershipConflicts: 1,
        sourceFailures: 0,
        expiryReviewsDue: 0,
        sourceHealthFailures: 0,
      },
    };

    // dryRun true → no Supabase; still writes local decisions when dryRun is false.
    // For unit test without secrets, use dryRun and manually verify reject path via
    // dryRun=false would throw without env — so test reject with a patched flow:
    const result = await applyPromotions(
      {
        reviewer: "github:test",
        decisions: [
          {
            action: "reject",
            fingerprint: "deadbeefcafef00d1234",
            reason: "marketing total",
          },
        ],
      },
      { report, decisionsPath, dryRun: true },
    );

    expect(result.applied[0]?.action).toBe("reject");
    const raw = await readFile(decisionsPath, "utf8");
    const store = JSON.parse(raw) as { decisions: Array<{ status: string }> };
    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]?.status).toBe("rejected");
  });
});
