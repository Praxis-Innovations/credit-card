import { effectiveEarnRate } from "./recommend";
import type { Category, CreditCard, MerchantBrand, RewardCategory, SpendToDate } from "./schema";
import { CATEGORY_LABELS } from "./schema";
import type { MccMatchKind, RecommendationWarning } from "./recommend-mcc-types";

function usableRules(card: CreditCard): RewardCategory[] {
  return card.rewardCategories.filter((r) => !r.userChosen);
}

function ruleIsActive(rule: RewardCategory, asOf: string): boolean {
  if (rule.validFrom && asOf < rule.validFrom) return false;
  if (rule.validTo && asOf > rule.validTo) return false;
  return true;
}

function merchantMatches(
  rule: RewardCategory,
  brand: MerchantBrand | null,
): boolean {
  if (!brand || !rule.merchants?.length) return false;
  const ids = new Set(rule.merchants.map((m) => m.toLowerCase()));
  return ids.has(brand.id.toLowerCase()) || ids.has(brand.name.toLowerCase());
}

function mccMatches(rule: RewardCategory, mcc: string | null): boolean {
  if (!mcc || !rule.mccs?.length) return false;
  return rule.mccs.includes(mcc);
}

export function isExcluded(
  rule: RewardCategory,
  brand: MerchantBrand | null,
  mcc: string | null,
): boolean {
  if (!rule.exclusions?.length) return false;
  const ex = rule.exclusions.map((e) => e.toLowerCase());
  if (
    brand &&
    (ex.includes(brand.id.toLowerCase()) || ex.includes(brand.name.toLowerCase()))
  ) {
    return true;
  }
  if (mcc && ex.includes(mcc)) return true;
  return false;
}

function userChosenWarnings(card: CreditCard): RecommendationWarning[] {
  const warnings: RecommendationWarning[] = [];
  for (const r of card.rewardCategories) {
    if (r.userChosen) {
      warnings.push({
        kind: "user_chosen_category",
        message: `${card.name}: user-chosen ${CATEGORY_LABELS[r.category]} bonus is not used in the calculation`,
      });
    }
  }
  return warnings;
}

export function pickEarnRule(
  card: CreditCard,
  brand: MerchantBrand | null,
  mcc: string | null,
  displayCategory: Category,
  asOf: string,
): { rule: RewardCategory; matchKind: MccMatchKind; warnings: RecommendationWarning[] } {
  const warnings = userChosenWarnings(card);
  const rules = usableRules(card).filter((r) => ruleIsActive(r, asOf));

  const named = rules.find(
    (r) => merchantMatches(r, brand) && !isExcluded(r, brand, mcc),
  );
  if (named) {
    return { rule: named, matchKind: "named_merchant", warnings };
  }

  const byMcc = rules.find(
    (r) => mccMatches(r, mcc) && !isExcluded(r, brand, mcc),
  );
  if (byMcc) {
    return { rule: byMcc, matchKind: "mcc_list", warnings };
  }

  const byCategory = rules.find((r) => {
    if (r.category !== displayCategory) return false;
    if (isExcluded(r, brand, mcc)) return false;
    if (r.merchants?.length) return false;
    if (r.mccs?.length && mcc && !r.mccs.includes(mcc)) return false;
    return true;
  });
  if (byCategory) {
    if (byCategory.category === "other") {
      return { rule: byCategory, matchKind: "base_rate", warnings };
    }
    const kind: MccMatchKind =
      byCategory.mccSource === "network_default" ||
      byCategory.mccs?.length ||
      mcc
        ? "category_default"
        : "user_category";
    return { rule: byCategory, matchKind: kind, warnings };
  }

  const base =
    rules.find((r) => r.category === "other") ??
    ({ category: "other", earnRate: 0 } satisfies RewardCategory);
  return { rule: base, matchKind: "base_rate", warnings };
}

export interface CapAndTierOptions {
  card: CreditCard;
  rule: RewardCategory;
  displayCategory: Category;
  spendToDate?: SpendToDate;
  capGroupSpend?: Record<string, number>;
  annualSpendByCard?: Record<string, number>;
}

function applyCapGroup(
  card: CreditCard,
  rule: RewardCategory,
  spendToDate: SpendToDate | undefined,
  capGroupSpend: Record<string, number> | undefined,
  warnings: RecommendationWarning[],
): { earnRate: number; capExhausted: boolean; warnings: RecommendationWarning[] } | null {
  if (!rule.capGroup) return null;
  const spent = capGroupSpend?.[rule.capGroup] ?? 0;
  const cap = rule.capMonthly ?? rule.capAnnual;
  if (cap !== undefined && spent >= cap) {
    const after = rule.rateAfterCap;
    if (after !== undefined) {
      return { earnRate: after, capExhausted: true, warnings };
    }
    const fallback = effectiveEarnRate(card, "other", spendToDate);
    return { earnRate: fallback.earnRate, capExhausted: true, warnings };
  }
  if (cap !== undefined && spent === 0) {
    warnings.push({
      kind: "cap_assumed_not_reached",
      message: `${card.name}: shared cap assumed not reached`,
    });
  }
  return { earnRate: rule.earnRate, capExhausted: false, warnings };
}

export function applyCapAndTier(
  options: CapAndTierOptions,
): { earnRate: number; capExhausted: boolean; warnings: RecommendationWarning[] } {
  const {
    card,
    rule,
    displayCategory,
    spendToDate,
    capGroupSpend,
    annualSpendByCard,
  } = options;
  const warnings: RecommendationWarning[] = [];

  if (rule.tierThreshold !== undefined) {
    const spent = annualSpendByCard?.[card.id] ?? 0;
    if (spent < rule.tierThreshold) {
      warnings.push({
        kind: "tier_assumed_not_reached",
        message: `${card.name}: spend tier $${rule.tierThreshold} not reached — using lower/base rate path`,
      });
      const fallback =
        card.rewardCategories.find((r) => r.category === "other") ??
        ({ category: "other", earnRate: 0 } satisfies RewardCategory);
      return { earnRate: fallback.earnRate, capExhausted: false, warnings };
    }
  }

  const capGroupResult = applyCapGroup(
    card,
    rule,
    spendToDate,
    capGroupSpend,
    warnings,
  );
  if (capGroupResult) return capGroupResult;

  const { earnRate, capExhausted } = effectiveEarnRate(
    card,
    displayCategory,
    spendToDate,
  );
  if (!capExhausted && rule.earnRate !== earnRate && rule.category === displayCategory) {
    return { earnRate: rule.earnRate, capExhausted: false, warnings };
  }
  if (!capExhausted) {
    return { earnRate: rule.earnRate, capExhausted: false, warnings };
  }
  if (rule.rateAfterCap !== undefined) {
    return { earnRate: rule.rateAfterCap, capExhausted: true, warnings };
  }
  return { earnRate, capExhausted, warnings };
}

export interface MccReasonOptions {
  card: CreditCard;
  matchKind: MccMatchKind;
  rule: RewardCategory;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  capExhausted: boolean;
  mcc: string | null;
  brand: MerchantBrand | null;
}

export function buildMccReason(options: MccReasonOptions): string {
  const {
    card,
    matchKind,
    rule,
    earnRate,
    centsPerDollar,
    capExhausted,
    mcc,
    brand,
  } = options;
  const label = CATEGORY_LABELS[rule.category].toLowerCase();
  const earn =
    card.pointCurrency === "cashback"
      ? `${earnRate}% cash back`
      : `${earnRate}× ${card.pointCurrency}`;
  if (capExhausted) {
    return `Bonus cap reached — ${earn} fallback (${centsPerDollar.toFixed(1)}¢/$)`;
  }
  switch (matchKind) {
    case "named_merchant":
      return brand
        ? `${earn} at ${brand.name} (named merchant)`
        : `${earn} on named merchant`;
    case "mcc_list":
      return mcc ? `${earn} on MCC ${mcc}` : `${earn} on MCC list`;
    case "category_default":
      return `${earn} on ${label} (category default codes)`;
    case "store_type_estimate":
      return `${earn} on ${label} (store-type estimate)`;
    case "user_category":
      return `${earn} on ${label} (category fallback)`;
    case "network_not_accepted":
      return "Network not accepted";
    default:
      return `${earn} base rate on ${label}`;
  }
}

export function welcomeWarning(card: CreditCard): RecommendationWarning | null {
  if (!card.welcomeOffer) return null;
  return {
    kind: "welcome_bonus",
    message: `Welcome bonus not included: ${card.welcomeOffer.summary}`,
  };
}
