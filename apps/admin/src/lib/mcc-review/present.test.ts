import { describe, expect, it } from "vitest";
import { chainFromFinding, groupFindingsByChain, proposedMcc, statusLabel } from "./present";
import type { BrandSnapshot, MerchantCodeFinding } from "./types";

function finding(
  partial: Partial<MerchantCodeFinding> & { proposed: Record<string, unknown> },
): MerchantCodeFinding {
  return {
    id: partial.id ?? "00000000-0000-4000-8000-000000000001",
    kind: partial.kind ?? "store_code",
    idempotency_key: partial.idempotency_key ?? "k",
    proposed: partial.proposed,
    review_status: partial.review_status ?? "pending",
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: partial.created_at ?? "2026-10-16T00:00:00Z",
  };
}

describe("groupFindingsByChain", () => {
  it("groups case-insensitively and lists proposed MCCs", () => {
    const brands: BrandSnapshot[] = [
      {
        id: "walmart",
        name: "Walmart",
        mcc: "5310",
        amex_mcc: null,
        certainty: "varies_by_store",
        status: "pending",
      },
    ];
    const findings = [
      finding({
        id: "00000000-0000-4000-8000-000000000001",
        proposed: { chain: "Walmart", mcc: "5310" },
      }),
      finding({
        id: "00000000-0000-4000-8000-000000000002",
        proposed: { chain: "walmart", mcc: "5411" },
      }),
      finding({
        id: "00000000-0000-4000-8000-000000000003",
        kind: "test_purchase",
        proposed: { chain: "Rona", mcc_shown: "5200", statement_text: "RONA #1" },
      }),
    ];

    const groups = groupFindingsByChain(findings, brands);
    expect(groups).toHaveLength(2);
    const walmart = groups.find((g) => g.chain.toLowerCase() === "walmart")!;
    expect(walmart.currentMcc).toBe("5310");
    expect(walmart.proposedMccs).toEqual(["5310", "5411"]);
    expect(walmart.findings).toHaveLength(2);
    expect(chainFromFinding(findings[2]!)).toBe("Rona");
    expect(proposedMcc(findings[2]!)).toBe("5200");
  });
});

describe("statusLabel", () => {
  it("labels conflict", () => {
    expect(statusLabel("conflict")).toEqual({ label: "Conflict", tone: "bad" });
    expect(statusLabel("verified")).toEqual({ label: "Verified", tone: "ok" });
  });
});
