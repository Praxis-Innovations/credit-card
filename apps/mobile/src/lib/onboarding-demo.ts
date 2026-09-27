import type { RecommendationResponse } from "./api-types";
import { requestRecommendation } from "./recommend";

/** Sample wallet used only in the first-run demo — not written to storage. */
export const DEMO_WALLET_IDS = [
  "amex-cobalt",
  "tangerine-moneyback",
] as const;

export const DEMO_PURCHASE = {
  amountCad: 45,
  category: "dining" as const,
  merchant: "Cactus Club",
};

/**
 * Live recommendation for the onboarding “aha” moment via apps/api.
 */
export async function buildOnboardingDemoRecommendation(): Promise<RecommendationResponse> {
  const result = await requestRecommendation({
    amountCad: DEMO_PURCHASE.amountCad,
    category: DEMO_PURCHASE.category,
    merchant: DEMO_PURCHASE.merchant,
    ownedCardIds: [...DEMO_WALLET_IDS],
    limit: 3,
  });

  if ("error" in result) {
    throw new Error(result.error.message);
  }

  return result;
}

/** Short earn-rate label for the demo hero line (e.g. "5× Amex MR"). */
export function formatDemoEarnLabel(
  rec: RecommendationResponse["recommendations"][number],
): string {
  if (rec.card.pointCurrency === "cashback") {
    return `${rec.earnRate}% cash back`;
  }
  return `${rec.earnRate}× ${rec.card.pointCurrency}`;
}
