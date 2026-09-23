import { describe, expect, it } from "vitest";
import type { CreditCard, MerchantPartnership } from "../schema";
import { diffStagingAgainstProduction } from "./diff";
import type { StagingSnapshot } from "./types";

const baseCard = (over: Partial<CreditCard> & Pick<CreditCard, "id" | "name">): CreditCard => ({
  issuer: "Scotiabank",
  annualFee: 120,
  pointCurrency: "Scene+",
  lastVerified: "2026-09-20",
  rewardCategories: [
    { category: "groceries", earnRate: 5 },
    { category: "other", earnRate: 1 },
  ],
  network: "Visa",
  ...over,
});

function snapshot(partial: Partial<StagingSnapshot> & Pick<StagingSnapshot, "facts" | "sources">): StagingSnapshot {
  return {
    pipelineVersion: "test",
    runId: "test-run",
    scope: "big-six",
    capturedAt: "2026-09-22T12:00:00.000Z",
    ...partial,
  };
}

describe("diffStagingAgainstProduction", () => {
  it("flags fee changes when staging fee differs from catalog", () => {
    const cards = [baseCard({ id: "scotia-passport-vi", name: "Passport Visa Infinite", annualFee: 150 })];
    const snap = snapshot({
      sources: [
        {
          sourceId: "scotia-cards",
          url: "https://example.test/cards",
          issuer: "Scotiabank",
          kind: "card_listing",
          capturedAt: "2026-09-22T12:00:00.000Z",
          outcome: "ok",
          robotsChecked: true,
        },
      ],
      facts: [
        {
          id: "f1",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Passport Visa Infinite",
          rawValue: "Passport Visa Infinite",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
        {
          id: "f2",
          kind: "annual_fee",
          issuer: "Scotiabank",
          subject: "Passport Visa Infinite",
          rawValue: "Annual Fee $139",
          parsedNumber: 139,
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards,
      partnerships: [],
    });

    const fee = report.findings.filter((f) => f.kind === "fee_change_candidate");
    expect(fee).toHaveLength(1);
    expect(fee[0]?.productionValue).toBe("150");
    expect(fee[0]?.stagingValue).toBe("139");
    expect(report.summary.feeChanges).toBe(1);
  });

  it("does not flag fees within tolerance / exact match", () => {
    const cards = [baseCard({ id: "scotia-passport-vi", name: "Passport Visa Infinite", annualFee: 150 })];
    const snap = snapshot({
      sources: [],
      facts: [
        {
          id: "f1",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Passport Visa Infinite",
          rawValue: "Passport® Visa Infinite",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
        {
          id: "f2",
          kind: "annual_fee",
          issuer: "Scotiabank",
          subject: "Passport Visa Infinite",
          rawValue: "Annual Fee $150",
          parsedNumber: 150,
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards,
      partnerships: [],
    });

    expect(report.summary.feeChanges).toBe(0);
    expect(report.findings.some((f) => f.kind === "unchanged_signal")).toBe(true);
  });

  it("flags new card candidates not in the catalog", () => {
    const cards = [baseCard({ id: "scotia-scene-visa", name: "Scene+ Visa", annualFee: 0 })];
    const snap = snapshot({
      sources: [],
      facts: [
        {
          id: "f1",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Scene+ Visa",
          rawValue: "Scene+ Visa",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
        {
          id: "f2",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Ultra Phantom Rewards Visa Infinite",
          rawValue: "Ultra Phantom Rewards Visa Infinite",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards,
      partnerships: [],
    });

    const novel = report.findings.filter((f) => f.kind === "new_card_candidate");
    expect(novel.some((f) => f.subject.includes("Phantom"))).toBe(true);
    expect(novel.some((f) => f.subject === "Scene+ Visa")).toBe(false);
  });

  it("flags partnership benefit conflicts against cited production amounts", () => {
    const partnerships: MerchantPartnership[] = [
      {
        id: "shell-scene-scotia-scene-cards",
        merchantBrandIds: ["shell"],
        loyaltyProgramId: "scene-plus",
        cardIds: ["scotia-gold-amex"],
        affiliation: "linked",
        requirements: "Link card to Shell Go+",
        benefits: [
          {
            kind: "cents_per_litre_instant",
            amount: 3,
            summary: "Instant 3¢/L",
          },
        ],
        stacksWithCardCategoryRewards: true,
        sourceUrls: ["https://example.test/shell"],
        lastVerified: "2026-09-22",
      },
    ];

    const snap = snapshot({
      sources: [],
      facts: [
        {
          id: "b1",
          kind: "benefit_amount",
          issuer: "Scotiabank",
          brand: "Shell",
          subject: "Shell:cents_per_litre",
          rawValue: "5¢ per litre",
          parsedNumber: 5,
          sourceUrl: "https://example.test/shell",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards: [],
      partnerships,
    });

    expect(report.summary.partnershipConflicts).toBe(1);
    expect(report.findings[0]?.severity).toBe("conflict");
    expect(report.findings[0]?.productionValue).toBe("3");
  });

  it("does not conflict when staged benefit matches a cited amount", () => {
    const partnerships: MerchantPartnership[] = [
      {
        id: "journie-cibc-gas-discount",
        merchantBrandIds: ["pioneer"],
        loyaltyProgramId: "journie",
        cardIds: ["cibc-dividend"],
        affiliation: "linked",
        requirements: "Link card to JOURNIE",
        benefits: [
          {
            kind: "cents_per_litre_instant",
            amount: 3,
            summary: "Instant 3¢/L",
          },
        ],
        stacksWithCardCategoryRewards: true,
        sourceUrls: ["https://example.test/journie"],
        lastVerified: "2026-09-22",
      },
    ];

    const snap = snapshot({
      sources: [],
      facts: [
        {
          id: "b1",
          kind: "benefit_amount",
          issuer: "CIBC",
          brand: "JOURNIE",
          subject: "JOURNIE:cents_per_litre",
          rawValue: "3 cents per litre",
          parsedNumber: 3,
          sourceUrl: "https://example.test/journie",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards: [],
      partnerships,
    });

    expect(report.summary.partnershipConflicts).toBe(0);
  });

  it("records source failures from the snapshot", () => {
    const snap = snapshot({
      sources: [
        {
          sourceId: "bmo-cards",
          url: "https://example.test/bmo",
          issuer: "BMO",
          kind: "card_listing",
          capturedAt: "2026-09-22T12:00:00.000Z",
          outcome: "network_error",
          error: "Timeout",
          robotsChecked: true,
        },
      ],
      facts: [],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards: [],
      partnerships: [],
    });

    expect(report.summary.sourceFailures).toBe(1);
    expect(report.findings[0]?.kind).toBe("source_failure");
  });

  it("flags removed-card candidates when other issuer cards were seen", () => {
    const cards = [
      baseCard({ id: "a", name: "Momentum Visa Infinite", annualFee: 120 }),
      baseCard({ id: "b", name: "Gold American Express", annualFee: 120 }),
    ];
    const snap = snapshot({
      sources: [],
      facts: [
        {
          id: "n1",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Momentum Visa Infinite",
          rawValue: "Momentum Visa Infinite",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
        {
          id: "n2",
          kind: "card_name",
          issuer: "Scotiabank",
          subject: "Some Other Listing Card Visa",
          rawValue: "Some Other Listing Card Visa",
          sourceUrl: "https://example.test/cards",
          capturedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
    });

    const report = diffStagingAgainstProduction({
      snapshot: snap,
      cards,
      partnerships: [],
    });

    const removed = report.findings.filter((f) => f.kind === "removed_card_candidate");
    expect(removed.some((f) => f.subject === "Gold American Express")).toBe(true);
    expect(removed.some((f) => f.subject === "Momentum Visa Infinite")).toBe(false);
  });
});
