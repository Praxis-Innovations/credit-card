"use client";

import {
  CATEGORY_LABELS,
  CERTAINTY_FILTERS,
  DISPLAY_CATEGORIES,
  type CertaintyFilter,
} from "@/lib/store-codes/types";

const field =
  "h-10 w-full rounded-lg border border-field bg-surface px-2.5 text-sm text-ink";

const chipBase =
  "h-9 rounded-[9px] border-0 px-3.5 text-sm font-semibold transition-colors";

export function CertaintyChips({
  value,
  counts,
  onChange,
}: {
  value: CertaintyFilter;
  counts: Record<CertaintyFilter, number>;
  onChange: (next: CertaintyFilter) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Certainty"
      className="flex flex-wrap gap-1 self-start rounded-xl bg-line-soft p-1"
    >
      {CERTAINTY_FILTERS.map((chip) => {
        const checked = value === chip.value;
        const count = counts[chip.value];
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={checked}
            className={
              checked
                ? `${chipBase} bg-surface text-ink shadow-sm`
                : `${chipBase} bg-transparent text-body hover:text-ink`
            }
            onClick={() => onChange(chip.value)}
          >
            {chip.label} ({count.toLocaleString("en-CA")})
          </button>
        );
      })}
    </div>
  );
}

export function StoreCodesSearchFilters({
  query,
  category,
  onQuery,
  onCategory,
}: {
  query: string;
  category: string;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5 text-[12px] text-body">
        Search
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Store chain or MCC"
          className={`${field} w-[240px]`}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[12px] text-body">
        Category
        <select
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          className={`${field} min-w-[150px]`}
        >
          <option value="">All 10 categories</option>
          {DISPLAY_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
