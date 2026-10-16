export const IMPORT_KINDS = [
  "store_codes",
  "test_purchases",
  "mcc_codes",
  "category_mccs",
  "store_type_mccs",
] as const;

export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportRejection {
  row: number;
  reason: string;
  raw?: Record<string, string>;
}

export interface ImportResult {
  kind: ImportKind;
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: ImportRejection[];
}

export interface FindingWrite {
  kind: ImportKind;
  idempotencyKey: string;
  proposed: Record<string, unknown>;
}

export interface FindingStore {
  get(kind: ImportKind, idempotencyKey: string): Promise<Record<string, unknown> | null>;
  upsert(write: FindingWrite): Promise<"inserted" | "updated" | "unchanged">;
}
