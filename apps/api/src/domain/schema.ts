/**
 * Normalized spending categories for Canadian credit card rewards.
 */
export const CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "transit",
  "drugstore",
  "recurring_bills",
  "travel",
  "foreign_currency",
  "entertainment",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: "Groceries",
  dining: "Dining",
  gas: "Gas",
  transit: "Transit",
  drugstore: "Drugstore",
  recurring_bills: "Recurring bills",
  travel: "Travel",
  foreign_currency: "Foreign currency",
  entertainment: "Entertainment",
  other: "Everything else",
};

/**
 * Point / reward currencies common on Canadian cards.
 */
export const POINT_CURRENCIES = [
  "Aeroplan",
  "Scene+",
  "TD Rewards",
  "RBC Avion",
  "CIBC Aventura",
  "Amex MR",
  "BMO Rewards",
  "WestJet",
  "AIR MILES",
  "Marriott Bonvoy",
  "cashback",
  "PC Optimum",
  "Rogers",
  "Triangle",
  "Moi",
] as const;

export type PointCurrency = (typeof POINT_CURRENCIES)[number];

export const ISSUERS = [
  "American Express",
  "TD",
  "CIBC",
  "Scotiabank",
  "RBC",
  "BMO",
  "Rogers",
  "Tangerine",
  "PC Financial",
  "Simplii",
  "Neo",
  "Canadian Tire",
  "National Bank",
  "Desjardins",
  "HSBC",
  "MBNA",
] as const;

export type Issuer = (typeof ISSUERS)[number];

export interface RewardCategory {
  category: Category;
  /** Points (or cashback cents) earned per dollar spent. */
  earnRate: number;
  /** Optional monthly earn cap in dollars of spend. */
  capMonthly?: number;
  /** Optional annual earn cap in dollars of spend. */
  capAnnual?: number;
}

export interface WelcomeOffer {
  summary: string;
  /** Rough CAD value of the offer when completed. */
  estimatedValueCad?: number;
}

export interface CreditCard {
  id: string;
  issuer: Issuer;
  name: string;
  annualFee: number;
  pointCurrency: PointCurrency;
  rewardCategories: RewardCategory[];
  /** ISO date string — when rates were last spot-checked. */
  lastVerified: string;
  welcomeOffer?: WelcomeOffer;
  network?: "Visa" | "Mastercard" | "Amex";
  /** Optional marketing tier label shown in UI. */
  tier?: string;
}

export interface PointValuations {
  [currency: string]: number;
}

export interface SpendToDate {
  /** Spend already applied toward a monthly cap this period (CAD). */
  monthly?: Partial<Record<Category, number>>;
  /** Spend already applied toward an annual cap this year (CAD). */
  annual?: Partial<Record<Category, number>>;
}

export interface RecommendationInput {
  ownedCardIds: string[];
  category: Category;
  /** Optional spend-to-date for cap exhaustion. Not persisted by the engine. */
  spendToDate?: SpendToDate;
  /** Override default point valuations (cents CAD per point). */
  valuations?: Partial<Record<PointCurrency, number>>;
  /** Optional card catalog override (defaults to built-in dataset). */
  cards?: CreditCard[];
}

export interface Recommendation {
  card: CreditCard;
  /** Effective earn rate after caps (points or cashback cents per $). */
  earnRate: number;
  /** Cents CAD per point (or 1 for cashback). */
  pointValue: number;
  /** cents-back-per-dollar = earnRate × pointValue */
  centsPerDollar: number;
  /** True when a spend cap has been fully exhausted for this category. */
  capExhausted: boolean;
  reason: string;
}

// ── Merchant / loyalty partnerships ─────────────────────────────────

/**
 * How a card relates to a merchant partnership.
 *
 * Canadian gas/merchant deals usually run brand → loyalty program → linked
 * card(s), not a flat brand→card map. `direct` covers co-branded merchant
 * cards with no separate loyalty layer (e.g. CIBC Costco Mastercard at Costco Gas).
 */
export const CARD_AFFILIATIONS = [
  /** Card must be linked to the loyalty / pump account (Shell Go+, JOURNIE, Moi). */
  "linked",
  /** Co-branded or program-affiliated card; paying with it earns program rewards. */
  "affiliated",
  /** No loyalty program layer — card earns directly at the merchant. */
  "direct",
] as const;

export type CardAffiliation = (typeof CARD_AFFILIATIONS)[number];

export const PARTNERSHIP_BENEFIT_KINDS = [
  /** Instant pump discount in Canadian cents per litre. */
  "cents_per_litre_instant",
  /** Rewards value expressed as cents per litre (e.g. CT Money, Scene+ value). */
  "cents_per_litre_rewards",
  /** Loyalty points awarded per litre of fuel. */
  "points_per_litre",
  /** Loyalty points (or cashback cents) per dollar of spend. */
  "points_per_dollar",
  /** Cash-back percentage of spend. */
  "cashback_percent",
] as const;

export type PartnershipBenefitKind =
  (typeof PARTNERSHIP_BENEFIT_KINDS)[number];

/**
 * A cited benefit within a merchant↔loyalty↔card partnership.
 * Every numeric claim must be backed by `sourceUrls` on the parent partnership.
 */
export interface PartnershipBenefit {
  kind: PartnershipBenefitKind;
  /**
   * Magnitude of the benefit.
   * - cents_per_litre_*: Canadian cents (e.g. 3 = 3¢/L)
   * - points_per_litre / points_per_dollar: points (or cashback cents for cashback cards)
   * - cashback_percent: percent of spend (e.g. 3 = 3%)
   */
  amount: number;
  /** Short human-readable description of this benefit. */
  summary: string;
  /** Product / fuel / banner qualifier when the rate is not universal. */
  appliesTo?: string;
  /** Monthly litre cap for per-litre benefits. */
  capLitresMonthly?: number;
  /** Per-fill litre cap. */
  capLitresPerFill?: number;
  /** Annual spend cap in CAD for percent / points-per-dollar benefits. */
  capAnnualSpendCad?: number;
  /** True when the benefit is a limited-time promotion. */
  promotional?: boolean;
  /** ISO date when a promotional benefit is scheduled to end, if published. */
  promotionalEnds?: string;
  /** Currency of points_per_* benefits when distinct from the card's currency. */
  pointCurrency?: PointCurrency;
}

/**
 * Merchant or retail brand that participates in Canadian reward partnerships
 * (gas banners, grocery banners, drugstores, warehouse clubs).
 */
export interface MerchantBrand {
  id: string;
  name: string;
  /** Primary spend category this brand maps to in the recommender. */
  category: Category;
  /** Operator / parent when relevant (e.g. Parkland, Loblaw, Empire). */
  operator?: string;
  /** Station / store-count or regional scope notes from the cited source. */
  notes?: string;
  sourceUrl: string;
  lastVerified: string;
}

/**
 * Loyalty / rewards program that sits between brands and cards
 * (Scene+, JOURNIE, Triangle, PC Optimum, Moi). Omit for direct card deals.
 */
export interface LoyaltyProgram {
  id: string;
  name: string;
  /** Program's native point currency when it maps to a known currency. */
  pointCurrency?: PointCurrency;
  description?: string;
  sourceUrl: string;
  lastVerified: string;
}

/**
 * A verified Canadian merchant ↔ loyalty ↔ card partnership.
 *
 * Production data only: every entry must include at least one `sourceUrl`
 * and a `lastVerified` ISO date. Do not invent partnerships.
 */
export interface MerchantPartnership {
  id: string;
  /** Brands / banners where the benefit applies. */
  merchantBrandIds: string[];
  /**
   * Loyalty program id, or `null` when the card earns directly at the merchant
   * with no separate loyalty layer (Costco Gas + CIBC Costco Mastercard).
   */
  loyaltyProgramId: string | null;
  /** Card catalog ids (`CreditCard.id`) that can unlock this partnership. */
  cardIds: string[];
  affiliation: CardAffiliation;
  /** What the cardholder must do (link accounts, scan membership, etc.). */
  requirements: string;
  benefits: PartnershipBenefit[];
  /**
   * When true, the partnership benefit stacks on top of the card's own
   * category earn rates (gas %, grocery ×, etc.).
   */
  stacksWithCardCategoryRewards: boolean;
  notes?: string;
  /** One or more primary-source URLs that document this partnership. */
  sourceUrls: string[];
  lastVerified: string;
}
