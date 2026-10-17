/**
 * Normalized spending categories for Canadian credit card rewards.
 * Shared by apps/api and apps/mobile — do not duplicate.
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
