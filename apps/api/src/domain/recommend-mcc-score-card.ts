import { recommendCardsForMerchant } from "./recommend-merchant";
import { cardEarnComponent } from "./recommend";
import type { CreditCard, MerchantBrand } from "./schema";
import { ASSUMED_CAD_PER_LITRE } from "./recommend-merchant";
import { buildValueBreakdown } from "./value-breakdown";
import { networkKey, resolveStoreCode } from "./recommend-mcc-resolve";
import {
  applyCapAndTier,
  buildMccReason,
  isExcluded,
  pickEarnRule,
  welcomeWarning,
} from "./recommend-mcc-rules";
import type { MccCardRecommendation, RecommendationWarning } from "./recommend-mcc-types";
import type { ScoreContext } from "./recommend-mcc-score";

interface EarnOutcome {
  earnRate: number;
  centsPerDollar: number;
  reason: string;
  valueComponents: import("./schema").ValueComponent[];
  usedPartnership: boolean;
  partnershipId?: string;
}

interface PartnershipReasonOptions {
  ctx: ScoreContext;
  card: CreditCard;
  brand: MerchantBrand;
  picked: ReturnType<typeof pickEarnRule>;
  capped: ReturnType<typeof applyCapAndTier>;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  mcc: string | null;
}

function networkRejectedRecommendation(
  card: CreditCard,
  ctx: ScoreContext,
  cardWarnings: RecommendationWarning[],
): MccCardRecommendation {
  const resolved = ctx.purchaseResolved;
  return {
    card,
    earnRate: 0,
    pointValue: ctx.valuations[card.pointCurrency] ?? 0,
    centsPerDollar: 0,
    estimatedCentsBack: 0,
    estimatedRewardCad: 0,
    capExhausted: false,
    reason: `Not accepted at ${resolved.brand!.name}`,
    matchKind: "network_not_accepted",
    confidence: resolved.certainty,
    effectiveMcc: resolved.mcc,
    displayCategory: resolved.displayCategory,
    warnings: cardWarnings,
    usedPartnership: false,
    valueComponents: [],
  };
}

function partnershipOrMccReason(options: PartnershipReasonOptions): EarnOutcome {
  const { ctx, card, brand, picked, capped, earnRate, pointValue, centsPerDollar, mcc } =
    options;
  const partnered = recommendCardsForMerchant({
    ownedCardIds: [card.id],
    category: brand.category,
    merchantBrandId: brand.id,
    fuelGrade: ctx.fuelGrade,
    spendToDate: ctx.input.spendToDate,
    valuations: ctx.input.valuations,
    cards: [card],
    catalog: ctx.catalog,
  });
  const hit = partnered[0];
  if (hit?.usedPartnership) {
    return {
      usedPartnership: true,
      partnershipId: hit.partnership?.id,
      reason: hit.reason,
      valueComponents: hit.valueComponents,
      earnRate: hit.earnRate,
      centsPerDollar: hit.centsPerDollar,
    };
  }
  return mccOnlyEarnOutcome({
    card,
    brand,
    picked,
    capped,
    earnRate,
    pointValue,
    centsPerDollar,
    mcc,
  });
}

function mccOnlyEarnOutcome(options: {
  card: CreditCard;
  brand: MerchantBrand | null;
  picked: ReturnType<typeof pickEarnRule>;
  capped: ReturnType<typeof applyCapAndTier>;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  mcc: string | null;
}): EarnOutcome {
  const { card, brand, picked, capped, earnRate, pointValue, centsPerDollar, mcc } =
    options;
  return {
    usedPartnership: false,
    earnRate,
    centsPerDollar,
    reason: buildMccReason({
      card,
      matchKind: picked.matchKind,
      rule: picked.rule,
      earnRate,
      pointValue,
      centsPerDollar,
      capExhausted: capped.capExhausted,
      mcc,
      brand,
    }),
    valueComponents: [
      cardEarnComponent(
        card,
        picked.rule.category,
        earnRate,
        pointValue,
        capped.capExhausted,
      ),
    ],
  };
}

interface ResolveEarnOptions {
  ctx: ScoreContext;
  card: CreditCard;
  brand: MerchantBrand | null;
  picked: ReturnType<typeof pickEarnRule>;
  capped: ReturnType<typeof applyCapAndTier>;
  mcc: string | null;
}

function resolveEarnOutcome(options: ResolveEarnOptions): EarnOutcome {
  const { ctx, card, brand, picked, capped, mcc } = options;
  const pointValue = ctx.valuations[card.pointCurrency] ?? 0;
  const earnRate = capped.earnRate;
  const centsPerDollar = earnRate * pointValue;
  if (brand) {
    return partnershipOrMccReason({
      ctx,
      card,
      brand,
      picked,
      capped,
      earnRate,
      pointValue,
      centsPerDollar,
      mcc,
    });
  }
  return mccOnlyEarnOutcome({
    card,
    brand,
    picked,
    capped,
    earnRate,
    pointValue,
    centsPerDollar,
    mcc,
  });
}

export function scoreOneCard(card: CreditCard, ctx: ScoreContext): MccCardRecommendation {
  const cardWarnings: RecommendationWarning[] = [];
  const welcome = welcomeWarning(card);
  if (welcome) cardWarnings.push(welcome);

  const net = networkKey(card.network);
  const brandAtPurchase = ctx.purchaseResolved.brand;
  if (
    brandAtPurchase?.acceptedNetworks?.length &&
    net &&
    !brandAtPurchase.acceptedNetworks.includes(net)
  ) {
    cardWarnings.push({
      kind: "network_not_accepted",
      message: `${brandAtPurchase.name} does not accept ${card.network}`,
    });
    return networkRejectedRecommendation(card, ctx, cardWarnings);
  }

  const storeForCard = resolveStoreCode(ctx.input, card.network);
  const { mcc, brand, displayCategory } = storeForCard;

  const picked = pickEarnRule(card, brand, mcc, displayCategory, ctx.asOf);
  cardWarnings.push(...picked.warnings);

  if (isExcluded(picked.rule, brand, mcc)) {
    cardWarnings.push({
      kind: "exclusion",
      message: `${card.name}: purchase excluded from bonus rate`,
    });
  }

  const capped = applyCapAndTier({
    card,
    rule: picked.rule,
    displayCategory,
    spendToDate: ctx.input.spendToDate,
    capGroupSpend: ctx.input.capGroupSpendToDate,
    annualSpendByCard: ctx.input.annualSpendByCard,
  });
  cardWarnings.push(...capped.warnings);

  const earn = resolveEarnOutcome({ ctx, card, brand, picked, capped, mcc });
  const breakdown = buildValueBreakdown(
    earn.valueComponents,
    ctx.input.amountCad,
    ASSUMED_CAD_PER_LITRE,
  );

  return {
    card,
    earnRate: earn.earnRate,
    pointValue: ctx.valuations[card.pointCurrency] ?? 0,
    centsPerDollar: earn.centsPerDollar,
    estimatedCentsBack: ctx.input.amountCad * earn.centsPerDollar,
    estimatedRewardCad: breakdown.totalCad,
    capExhausted: capped.capExhausted,
    reason: earn.reason,
    matchKind: earn.usedPartnership ? "named_merchant" : picked.matchKind,
    confidence: storeForCard.certainty,
    matchedRule: picked.rule,
    effectiveMcc: mcc,
    displayCategory,
    warnings: cardWarnings,
    usedPartnership: earn.usedPartnership,
    partnershipId: earn.partnershipId,
    valueComponents: earn.valueComponents,
  };
}
