"use client";

import { CARD_STATUS_FILTERS, type CardStatusFilter } from "@/lib/cards/types";

const field =
  "h-10 w-full rounded-lg border border-field bg-surface px-2.5 text-sm text-ink";

export function CardsFilters({
  query,
  issuer,
  status,
  issuers,
  onQuery,
  onIssuer,
  onStatus,
}: {
  query: string;
  issuer: string;
  status: CardStatusFilter;
  issuers: string[];
  onQuery: (value: string) => void;
  onIssuer: (value: string) => void;
  onStatus: (value: CardStatusFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
      <label className="flex flex-col gap-1 text-[13px] text-body">
        Search
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Card name or id"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-body">
        Issuer
        <input
          type="search"
          list="cards-issuer-options"
          value={issuer}
          onChange={(e) => onIssuer(e.target.value)}
          placeholder="Type to search issuers"
          className={field}
          autoComplete="off"
        />
        <datalist id="cards-issuer-options">
          {issuers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="flex min-w-[10rem] flex-col gap-1 text-[13px] text-body">
        Status
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as CardStatusFilter)}
          className={field}
        >
          {CARD_STATUS_FILTERS.map(({ value, label }) => (
            <option value={value} key={`status-${value}`}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
