import { describe, expect, it } from "vitest";
import { buildRecommendationResponse } from "./recommend-api";

describe("buildRecommendationResponse", () => {
  it("rejects empty wallet (no saved cards)", () => {
    const result = buildRecommendationResponse({
      amountCad: 50,
      category: "dining",
    });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.status).toBe(422);
    expect(result.error.code).toBe("empty_wallet");
  });

  it("returns empty recommendations for unknown card ids", () => {
    const result = buildRecommendationResponse({
      amountCad: 50,
      category: "dining",
      ownedCardIds: ["not-a-real-card"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.recommendations).toEqual([]);
    expect(result.bestCardId).toBeNull();
  });

  it("ranks via recommendCards and scales reward by amount", () => {
    const result = buildRecommendationResponse({
      amountCad: 100,
      category: "dining",
      merchant: "Cactus Club",
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.bestCardId).toBe("amex-cobalt");
    expect(result.recommendations[0]?.reason).toMatch(/best for this/i);
    expect(result.recommendations[0]?.estimatedRewardCad).toBeCloseTo(12, 5);
  });
});
