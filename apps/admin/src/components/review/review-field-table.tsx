"use client";

import type { FieldRow } from "@/lib/review/present";
import { MAX_FIELD_VALUE } from "@/lib/review/types";

export const barButton =
  "h-9 shrink-0 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

export type FieldState = { value: string; save: boolean };

export type FieldEditors = {
  onValue: (key: string, value: string) => void;
  onUndo: (key: string) => void;
  onSave: (key: string, save: boolean) => void;
};

function checkLabel(row: FieldRow): { text: string; className: string } {
  if (row.check === null) return { text: "Not checked", className: "text-muted" };
  if (row.check.ok) return { text: "Found in quote", className: "text-ok-fg" };
  return { text: row.check.issues.join("; ") || "Needs a look", className: "text-bad-fg" };
}

function FieldValueBox({
  row,
  state,
  canReview,
  isLive,
  onChange,
  onUndo,
}: {
  row: FieldRow;
  state: FieldState;
  canReview: boolean;
  isLive: boolean;
  onChange: (value: string) => void;
  onUndo: () => void;
}) {
  const edited = state.value !== row.proposed;
  return (
    <div
      className={`relative flex h-full min-h-[3.25rem] flex-col justify-center rounded-md border px-2 py-1.5 ${
        edited ? "border-teal bg-teal-soft/40" : "border-field bg-surface"
      } ${state.save ? "" : "opacity-50"}`}
    >
      {isLive && row.current !== null && row.changed ? (
        <span className="truncate text-[12px] text-muted line-through">{row.current}</span>
      ) : null}
      {canReview ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`${row.label} value`}
            value={state.value}
            maxLength={MAX_FIELD_VALUE}
            disabled={!state.save}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none disabled:cursor-not-allowed"
          />
          {edited ? (
            <button
              type="button"
              onClick={onUndo}
              className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold text-teal hover:bg-surface"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : (
        <span className="text-sm font-medium">{state.value}</span>
      )}
      {edited ? (
        <span className="truncate text-[11px] font-medium text-teal">Edited · page said {row.proposed}</span>
      ) : null}
    </div>
  );
}

type RowView = {
  row: FieldRow;
  state: FieldState;
  canReview: boolean;
  isLive: boolean;
  editors: FieldEditors;
};

function FieldRowCells({ row, state, canReview, isLive, editors }: RowView) {
  const check = checkLabel(row);
  return (
    <>
      <th scope="row" className="px-3 py-2 text-left font-semibold">
        <span className="line-clamp-2">{row.label}</span>
      </th>
      <td className="h-16 px-2 py-2">
        <FieldValueBox
          row={row}
          state={state}
          canReview={canReview}
          isLive={isLive}
          onChange={(v) => editors.onValue(row.key, v)}
          onUndo={() => editors.onUndo(row.key)}
        />
      </td>
      <td className="px-2 py-2">
        <p className="line-clamp-2 text-[13px] text-body italic">
          {row.quote ? <>&ldquo;{row.quote}&rdquo;</> : "No quote"}
        </p>
        <p className={`mt-0.5 text-[12px] font-medium ${check.className}`}>{check.text}</p>
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          aria-label={`Save ${row.label}`}
          checked={state.save}
          disabled={!canReview}
          onChange={(e) => editors.onSave(row.key, e.target.checked)}
          className="size-4 accent-teal"
        />
      </td>
    </>
  );
}

export type FieldsTableProps = {
  caption: string;
  rows: FieldRow[];
  states: Record<string, FieldState>;
  canReview: boolean;
  isLive: boolean;
  editors: FieldEditors;
};

export function FieldsTable({ caption, rows, states, canReview, isLive, editors }: FieldsTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[28%]" />
          <col className="w-[42%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Field
            </th>
            <th scope="col" className="px-2 py-2.5 font-semibold">
              Value
            </th>
            <th scope="col" className="px-2 py-2.5 font-semibold">
              Source quote
            </th>
            <th scope="col" className="px-2 py-2.5 text-center font-semibold">
              Save
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="h-16 border-t border-line-soft align-middle">
              <FieldRowCells
                row={row}
                state={states[row.key] ?? { value: row.proposed, save: true }}
                canReview={canReview}
                isLive={isLive}
                editors={editors}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
