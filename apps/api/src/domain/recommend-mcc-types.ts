import type { PartnershipCatalog } from "./recommend-merchant";
import type {
  Category,
  CreditCard,
  FuelGrade,
  MccCertainty,
  MerchantBrand,
  PointCurrency,
  RewardCategory,
  SpendToDate,
  ValueComponent,
} from "./schema";

/** How the store's MCC (or fallback) was resolved for this purchase. */
export type MccMatchKind =
  | "named_merchant"
  | "mcc_list"
  | "category_default"
  | "store_type_estimate"
  | "user_category"
  | "base_rate"
  | "network_not_accepted";

export interface RecommendationWarning {
  kind:
    | "welcome_bonus"
    | "user_chosen_category"
    | "certainty"
    | "network_not_accepted"
    | "cap_assumed_not_reached"
    | "tier_assumed_not_reached"
    | "exclusion";
  message: string;
}

export interface CategoryMccRow {
  category: Category;
  mcc: string;
}

export interface StoreTypeMccRow {
  osmTag: string;
  mcc: string;
}

export interface MccCatalog {
  categoryMccs?: CategoryMccRow[];
  storeTypeMccs?: StoreTypeMccRow[];
}

export interface MccRecommendationInput {
  amountCad: number;
  ownedCardIds: string[];
  store?: {
    brandId?: string;
    merchantQuery?: string;
    mcc?: string;
    osmTag?: string;
    name?: string;
  };
  mcc?: string;
  categoryFallback?: Category;
  fuelGrade?: FuelGrade;
  spendToDate?: SpendToDate;
  capGroupSpendToDate?: Record<string, number>;
  annualSpendByCard?: Record<string, number>;
  valuations?: Partial<Record<PointCurrency, number>>;
  cards?: CreditCard[];
  brands?: MerchantBrand[];
  catalog?: PartnershipCatalog;
  mccCatalog?: MccCatalog;
  asOf?: string;
  limit?: number;
}

export interface MccCardRecommendation {
  card: CreditCard;
  earnRate: number;
  pointValue: number;
  centsPerDollar: number;
  estimatedCentsBack: number;
  estimatedRewardCad: number;
  capExhausted: boolean;
  reason: string;
  matchKind: MccMatchKind;
  confidence: MccCertainty;
  matchedRule?: RewardCategory;
  effectiveMcc: string | null;
  displayCategory: Category;
  warnings: RecommendationWarning[];
  usedPartnership: boolean;
  partnershipId?: string;
  valueComponents: ValueComponent[];
}

export interface MccRecommendationResult {
  purchase: {
    amountCad: number;
    mcc: string | null;
    displayCategory: Category;
    merchant: string | null;
    merchantBrandId: string | null;
    certainty: MccCertainty;
    matchKind: MccMatchKind;
    fuelGrade: FuelGrade | null;
  };
  recommendations: MccCardRecommendation[];
  bestCardId: string | null;
  warnings: RecommendationWarning[];
}

export interface ResolvedStoreCode {
  mcc: string | null;
  brand: MerchantBrand | null;
  certainty: MccCertainty;
  matchKind: MccMatchKind;
  displayCategory: Category;
  warnings: RecommendationWarning[];
}
