"use client";

import type { CardOption } from "@/lib/store-codes/types";

const field =
  "h-11 w-full rounded-lg border border-field bg-surface px-3 text-sm text-ink";
const labelCls = "flex flex-col gap-1 text-[13px] font-semibold text-ink";

export type PurchaseFormState = {
  date: string;
  statement: string;
  cardId: string;
  mccShown: string;
  categoryShown: string;
};

export function PurchaseFields({
  brandName,
  cards,
  busy,
  state,
  onPatch,
}: {
  brandName: string;
  cards: CardOption[];
  busy: boolean;
  state: PurchaseFormState;
  onPatch: (partial: Partial<PurchaseFormState>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-4">
      <DateAndStatement brandName={brandName} busy={busy} state={state} onPatch={onPatch} />
      <CardAndShown cards={cards} busy={busy} state={state} onPatch={onPatch} />
    </div>
  );
}

function DateAndStatement({
  brandName,
  busy,
  state,
  onPatch,
}: {
  brandName: string;
  busy: boolean;
  state: PurchaseFormState;
  onPatch: (partial: Partial<PurchaseFormState>) => void;
}) {
  return (
    <>
      <label className={labelCls}>
        Date
        <input
          type="date"
          value={state.date}
          onChange={(e) => onPatch({ date: e.target.value })}
          className={field}
          disabled={busy}
        />
      </label>
      <label className={labelCls}>
        Statement line, copied as shown
        <input
          type="text"
          value={state.statement}
          onChange={(e) => onPatch({ statement: e.target.value })}
          placeholder={`${brandName.toUpperCase()} #3124 TORONTO ON`}
          className={`${field} font-mono`}
          disabled={busy}
          autoComplete="off"
        />
      </label>
    </>
  );
}

function CardAndShown({
  cards,
  busy,
  state,
  onPatch,
}: {
  cards: CardOption[];
  busy: boolean;
  state: PurchaseFormState;
  onPatch: (partial: Partial<PurchaseFormState>) => void;
}) {
  return (
    <>
      <label className={labelCls}>
        Card
        <select
          value={state.cardId}
          onChange={(e) => onPatch({ cardId: e.target.value })}
          className={field}
          disabled={busy || cards.length === 0}
        >
          {cards.length === 0 ? <option value="">No cards in catalog</option> : null}
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.network ? ` (${c.network})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Code, if shown (TD shows it)
        <input
          type="text"
          inputMode="numeric"
          value={state.mccShown}
          onChange={(e) => onPatch({ mccShown: e.target.value })}
          placeholder="e.g. 5411"
          className={field}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <label className={labelCls}>
        Category or points shown
        <input
          type="text"
          value={state.categoryShown}
          onChange={(e) => onPatch({ categoryShown: e.target.value })}
          placeholder='e.g. 3x grocery, or "Other"'
          className={field}
          disabled={busy}
          autoComplete="off"
        />
      </label>
    </>
  );
}
