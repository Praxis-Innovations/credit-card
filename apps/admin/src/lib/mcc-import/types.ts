export const IMPORT_KINDS = [
  "store_codes",
  "test_purchases",
  "mcc_codes",
  "category_mccs",
  "store_type_mccs",
] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  store_codes: "Store codes",
  test_purchases: "Test purchases",
  mcc_codes: "MCC codes",
  category_mccs: "Category → MCC",
  store_type_mccs: "Store type → MCC",
};

export type ImportRejection = {
  row: number;
  reason: string;
};

export type FindingWrite = {
  kind: ImportKind;
  idempotencyKey: string;
  proposed: Record<string, unknown>;
};

export type ImportResult = {
  kind: ImportKind;
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: ImportRejection[];
};

export function findingKindDb(kind: ImportKind): string {
  switch (kind) {
    case "store_codes":
      return "store_code";
    case "test_purchases":
      return "test_purchase";
    case "mcc_codes":
      return "mcc_code";
    case "category_mccs":
      return "category_mcc";
    case "store_type_mccs":
      return "store_type_mcc";
  }
}

export function isImportKind(value: string): value is ImportKind {
  return (IMPORT_KINDS as readonly string[]).includes(value);
}
