import { CARDS } from "./cards";
import { scoreOneCard } from "./recommend-mcc-score-card";
import { buildScoreContext, sortRecommendations } from "./recommend-mcc-score";
import type {
  MccCardRecommendation,
  MccRecommendationInput,
  MccRecommendationResult,
} from "./recommend-mcc-types";

/**
 * Rank owned cards for a store + amount using MCC-aware earn rules.
 * Caps/tiers are assumed not reached unless spend inputs say otherwise.
 * Welcome bonuses and user-chosen categories are warnings only.
 */
function buildPurchaseHeader(
  input: MccRecommendationInput,
  ctx: ReturnType<typeof buildScoreContext>,
) {
  return {
    amountCad: input.amountCad,
    mcc: ctx.purchaseResolved.mcc,
    displayCategory: ctx.purchaseResolved.displayCategory,
    merchant:
      input.store?.name ??
      ctx.purchaseResolved.brand?.name ??
      input.store?.merchantQuery ??
      null,
    merchantBrandId: ctx.purchaseResolved.brand?.id ?? null,
    certainty: ctx.purchaseResolved.certainty,
    matchKind: ctx.purchaseResolved.matchKind,
    fuelGrade:
      ctx.purchaseResolved.displayCategory === "gas" ? ctx.fuelGrade : null,
  };
}

export function recommendByMcc(
  input: MccRecommendationInput,
): MccRecommendationResult {
  const cards = input.cards ?? CARDS;
  const owned = new Set(input.ownedCardIds);
  const ctx = buildScoreContext(input);
  const purchaseWarnings = [...ctx.purchaseResolved.warnings];

  const results: MccCardRecommendation[] = [];
  for (const card of cards) {
    if (!owned.has(card.id)) continue;
    results.push(scoreOneCard(card, ctx));
  }

  sortRecommendations(results);

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const sliced = results.slice(0, limit);

  return {
    purchase: buildPurchaseHeader(input, ctx),
    recommendations: sliced,
    bestCardId: sliced[0]?.card.id ?? null,
    warnings: purchaseWarnings,
  };
}
