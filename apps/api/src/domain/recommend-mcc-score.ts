import { DEFAULT_FUEL_GRADE, type PartnershipCatalog } from "./recommend-merchant";
import type { FuelGrade, MerchantBrand } from "./schema";
import { resolveValuations } from "./valuations";
import { resolveStoreCode } from "./recommend-mcc-resolve";
import { compareByCentsThenFeeThenName } from "./recommend-rank";
import type { MccCardRecommendation, MccRecommendationInput } from "./recommend-mcc-types";

export interface ScoreContext {
  input: MccRecommendationInput;
  asOf: string;
  fuelGrade: FuelGrade;
  valuations: ReturnType<typeof resolveValuations>;
  brands: MerchantBrand[];
  catalog: PartnershipCatalog;
  purchaseResolved: ReturnType<typeof resolveStoreCode>;
}

export function buildScoreContext(input: MccRecommendationInput): ScoreContext {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const brands = input.brands ?? [];
  const fuelGrade = input.fuelGrade ?? DEFAULT_FUEL_GRADE;
  const valuations = resolveValuations(input.valuations);
  const purchaseResolved = resolveStoreCode(input);
  const catalog = input.catalog ?? { brands };
  return {
    input,
    asOf,
    fuelGrade,
    valuations,
    brands,
    catalog,
    purchaseResolved,
  };
}

export function sortRecommendations(items: MccCardRecommendation[]): void {
  items.sort(compareByCentsThenFeeThenName);
}
