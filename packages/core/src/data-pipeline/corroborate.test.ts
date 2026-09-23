import { describe, expect, it } from "vitest";
import { corroborateConflicts } from "./corroborate";
import type { DiffFinding } from "./types";

describe("corroborateConflicts", () => {
  it("notes when only one source exists", async () => {
    const findings: DiffFinding[] = [
      {
        fingerprint: "abc",
        kind: "partnership_conflict",
        severity: "conflict",
        status: "pending",
        issuer: "CIBC",
        subject: "JOURNIE",
        summary: "conflict",
        productionValue: "3",
        stagingValue: "10",
        sourceUrls: ["https://example.test/only"],
        relatedFactIds: [],
      },
    ];
    const out = await corroborateConflicts(findings, async () => {
      throw new Error("should not fetch");
    });
    expect(out[0]?.corroboration?.agreesWith).toBe("unavailable");
    expect(out[0]?.corroboration?.note).toMatch(/Only one source/i);
  });

  it("checks a third source and records agreement", async () => {
    const findings: DiffFinding[] = [
      {
        fingerprint: "def",
        kind: "partnership_conflict",
        severity: "conflict",
        status: "pending",
        issuer: "Scotiabank",
        subject: "Shell",
        summary: "conflict",
        productionValue: "3",
        stagingValue: "10",
        sourceUrls: [
          "https://example.test/primary",
          "https://example.test/third",
        ],
        relatedFactIds: [],
      },
    ];

    const out = await corroborateConflicts(findings, async (url) => {
      expect(String(url)).toContain("third");
      return new Response(
        "<html><body>Save up to 10 cents per litre at Shell. Base instant is 3¢.</body></html>",
        { status: 200 },
      );
    });

    expect(out[0]?.corroboration?.thirdSourceUrl).toContain("third");
    expect(out[0]?.corroboration?.agreesWith).toBe("both");
  });
});
