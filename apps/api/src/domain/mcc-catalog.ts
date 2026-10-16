import type { Category } from "./schema";
import type { CategoryMccRow, StoreTypeMccRow } from "./recommend-mcc";

/**
 * Static verified MCC ↔ display-category map for `NORTHTAP_CATALOG_SOURCE=static`.
 * Mirrors what approved `category_mccs` rows will look like in Supabase.
 * Keep CATEGORIES fixed — new display groups are rows here, not enum growth.
 */
export const CATEGORY_MCCS: readonly CategoryMccRow[] = [
  { category: "groceries", mcc: "5411" },
  { category: "groceries", mcc: "5422" },
  { category: "groceries", mcc: "5441" },
  { category: "groceries", mcc: "5451" },
  { category: "groceries", mcc: "5462" },
  { category: "dining", mcc: "5812" },
  { category: "dining", mcc: "5814" },
  { category: "gas", mcc: "5541" },
  { category: "gas", mcc: "5542" },
  { category: "transit", mcc: "4111" },
  { category: "transit", mcc: "4121" },
  { category: "transit", mcc: "4131" },
  { category: "drugstore", mcc: "5912" },
  { category: "recurring_bills", mcc: "4814" },
  { category: "recurring_bills", mcc: "4900" },
  { category: "travel", mcc: "3000" },
  { category: "travel", mcc: "4511" },
  { category: "travel", mcc: "7011" },
  { category: "entertainment", mcc: "7832" },
  { category: "entertainment", mcc: "7922" },
  { category: "entertainment", mcc: "7996" },
  { category: "other", mcc: "5300" },
  { category: "other", mcc: "5310" },
  { category: "other", mcc: "5311" },
  { category: "other", mcc: "5200" },
  { category: "other", mcc: "5732" },
];

/**
 * Static OSM tag → MCC estimates for store-type fallback.
 * Mirrors approved `store_type_mccs` rows.
 */
export const STORE_TYPE_MCCS: readonly StoreTypeMccRow[] = [
  { osmTag: "shop=supermarket", mcc: "5411" },
  { osmTag: "shop=convenience", mcc: "5411" },
  { osmTag: "shop=greengrocer", mcc: "5422" },
  { osmTag: "shop=bakery", mcc: "5462" },
  { osmTag: "amenity=restaurant", mcc: "5812" },
  { osmTag: "amenity=fast_food", mcc: "5814" },
  { osmTag: "amenity=cafe", mcc: "5814" },
  { osmTag: "amenity=fuel", mcc: "5541" },
  { osmTag: "shop=chemist", mcc: "5912" },
  { osmTag: "shop=pharmacy", mcc: "5912" },
  { osmTag: "railway=station", mcc: "4111" },
  { osmTag: "highway=bus_stop", mcc: "4131" },
  { osmTag: "shop=department_store", mcc: "5311" },
  { osmTag: "shop=wholesale", mcc: "5300" },
  { osmTag: "shop=electronics", mcc: "5732" },
  { osmTag: "shop=doityourself", mcc: "5200" },
];

export function categoryForStaticMcc(mcc: string): Category | undefined {
  return CATEGORY_MCCS.find((r) => r.mcc === mcc)?.category;
}
