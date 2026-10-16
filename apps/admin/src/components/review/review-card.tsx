"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { approveFinding, rejectFinding, type ReviewResult } from "@/app/(console)/review/actions";
import { StatusPill } from "@/components/sources/status-pill";
import {
  buildFieldRows,
  DIFF_LABELS,
  failedChecks,
  splitFieldRows,
  type FieldRow,
} from "@/lib/review/present";
import { MAX_FIELD_VALUE, MAX_REVIEW_NOTE, type FieldDecision, type PendingFinding } from "@/lib/review/types";
import { formatDate } from "@/lib/sources/present";

const barButton =
  "h-9 shrink-0 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

type FieldState = {
  value: string;
  save: boolean;
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

function FieldsTable({
  caption,
  rows,
  states,
  canReview,
  isLive,
  onValue,
  onUndo,
  onSave,
}: {
  caption: string;
  rows: FieldRow[];
  states: Record<string, FieldState>;
  canReview: boolean;
  isLive: boolean;
  onValue: (key: string, value: string) => void;
  onUndo: (key: string) => void;
  onSave: (key: string, save: boolean) => void;
}) {
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
          {rows.map((row) => {
            const state = states[row.key] ?? { value: row.proposed, save: true };
            const check = checkLabel(row);
            return (
              <tr key={row.key} className="h-16 border-t border-line-soft align-middle">
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  <span className="line-clamp-2">{row.label}</span>
                </th>
                <td className="h-16 px-2 py-2">
                  <FieldValueBox
                    row={row}
                    state={state}
                    canReview={canReview}
                    isLive={isLive}
                    onChange={(v) => onValue(row.key, v)}
                    onUndo={() => onUndo(row.key)}
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
                    onChange={(e) => onSave(row.key, e.target.checked)}
                    className="size-4 accent-teal"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReviewCard({
  finding,
  index,
  total,
  previousId,
  nextId,
  canReview,
}: {
  finding: PendingFinding;
  index: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  canReview: boolean;
}) {
  const router = useRouter();
  const rows = useMemo(() => buildFieldRows(finding), [finding]);
  const { needsLook, looksRight } = useMemo(() => splitFieldRows(rows), [rows]);
  const [states, setStates] = useState<Record<string, FieldState>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, { value: r.proposed, save: true }])),
  );
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isLive = Boolean(finding.linked_card_id) && finding.diff_kind !== "new";
  const isNew = finding.diff_kind === "new";
  const discontinued = finding.diff_kind === "possibly_discontinued";
  const pendingReview = total > 0;
  const kind = finding.diff_kind ? DIFF_LABELS[finding.diff_kind] : null;
  const name = finding.card_name ?? finding.linked_card_id ?? "Unnamed card";
  const failed = failedChecks(finding);

  const savedCount = rows.filter((r) => states[r.key]?.save !== false).length;
  const editedCount = rows.filter((r) => states[r.key]?.value !== r.proposed).length;

  const decisions = (): FieldDecision[] =>
    rows.map((r) => ({
      key: r.key,
      save: states[r.key]?.save ?? true,
      page_value: r.proposed,
      value: states[r.key]?.value ?? r.proposed,
    }));

  const run = (action: () => Promise<ReviewResult>) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
        if (res.ok) {
          const dest = res.nextId ? `/review/${res.nextId}` : "/review";
          router.push(dest);
          router.refresh();
        }
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={barButton} onClick={() => router.push("/review")}>
          ← Queue
        </button>
        {pendingReview ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-body tabular-nums">
              Card {index + 1} of {total}
            </span>
            <button
              type="button"
              className={barButton}
              disabled={!previousId || pending}
              onClick={() => previousId && router.push(`/review/${previousId}`)}
            >
              Previous
            </button>
            <button
              type="button"
              className={barButton}
              disabled={!nextId || pending}
              onClick={() => nextId && router.push(`/review/${nextId}`)}
            >
              Skip
            </button>
          </div>
        ) : (
          <span className="text-[13px] text-body">Not in the pending queue</span>
        )}
      </div>

      <header className="rounded-xl border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[26px] leading-tight font-semibold">{name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-body">
              <span>{finding.source?.issuer_name ?? "Unknown issuer"}</span>
              {kind ? <StatusPill {...kind} /> : null}
              <span>{formatDate(finding.run?.created_at ?? finding.created_at)}</span>
              {finding.linked_card_id ? <span>Catalog: {finding.linked_card_id}</span> : null}
            </div>
          </div>
          {finding.product_url ? (
            <a
              href={finding.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${barButton} inline-flex items-center no-underline`}
            >
              Open source page
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
        {isNew ? (
          <p role="note" className="mt-3 rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
            Is this a separate card? Approving writes the saved field values to the live catalog immediately.
          </p>
        ) : null}
        {discontinued ? (
          <p role="note" className="mt-3 rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
            The crawler could not find this catalog card on the issuer&apos;s site. Approving only records that you
            agree it may be discontinued.
          </p>
        ) : null}
        {failed.length > 0 ? (
          <p role="note" className="mt-3 rounded-lg bg-bad-bg px-4 py-2.5 text-sm text-bad-fg">
            {failed.length === 1 ? "1 check failed" : `${failed.length} checks failed`}. Verify against the source page
            before approving.
          </p>
        ) : null}
      </header>

      <p
        role="status"
        aria-live="polite"
        className={
          notice
            ? `rounded-lg px-4 py-2.5 text-sm font-medium ${notice.ok ? "bg-ok-bg text-ok-fg" : "bg-bad-bg text-bad-fg"}`
            : "sr-only"
        }
      >
        {notice?.message ?? ""}
      </p>

      {!canReview ? (
        <p className="text-[13px] text-body">Read-only: only validators and admins can review findings.</p>
      ) : null}

      {rows.length === 0 && !discontinued ? (
        <p className="text-sm text-body">No extracted values on this finding.</p>
      ) : null}

      {needsLook.length > 0 ? (
        <section aria-labelledby="needs-look-heading" className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h2 id="needs-look-heading" className="text-[15px] font-semibold text-warn-fg">
              Needs a look
            </h2>
            <span className="text-[13px] text-body">{needsLook.length}</span>
          </div>
          <div className="rounded-xl border border-warn-fg/20 bg-warn-bg/40 p-2 sm:p-3">
            <FieldsTable
              caption={`Fields that need a look for ${name}`}
              rows={needsLook}
              states={states}
              canReview={canReview}
              isLive={isLive}
              onValue={(key, value) => setStates((s) => ({ ...s, [key]: { ...s[key]!, value } }))}
              onUndo={(key) => {
                const row = rows.find((r) => r.key === key);
                if (!row) return;
                setStates((s) => ({ ...s, [key]: { ...s[key]!, value: row.proposed } }));
              }}
              onSave={(key, save) => setStates((s) => ({ ...s, [key]: { ...s[key]!, save } }))}
            />
          </div>
        </section>
      ) : null}

      {looksRight.length > 0 ? (
        <section aria-labelledby="looks-right-heading" className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <h2 id="looks-right-heading" className="text-[15px] font-semibold">
              Looks right
            </h2>
            <span className="text-[13px] text-body">{looksRight.length}</span>
          </div>
          <FieldsTable
            caption={`Fields that look right for ${name}`}
            rows={looksRight}
            states={states}
            canReview={canReview}
            isLive={isLive}
            onValue={(key, value) => setStates((s) => ({ ...s, [key]: { ...s[key]!, value } }))}
            onUndo={(key) => {
              const row = rows.find((r) => r.key === key);
              if (!row) return;
              setStates((s) => ({ ...s, [key]: { ...s[key]!, value: row.proposed } }));
            }}
            onSave={(key, save) => setStates((s) => ({ ...s, [key]: { ...s[key]!, save } }))}
          />
        </section>
      ) : null}

      {canReview ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm lg:left-[264px]">
          <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <p className="min-w-[12rem] flex-1 text-[13px] font-medium text-body">
              {rows.length === 0 ? (
                "No fields to save"
              ) : (
                <>
                  {savedCount} of {rows.length} fields will be saved
                  {editedCount > 0 ? (
                    <>
                      {" "}
                      · {editedCount} edited
                    </>
                  ) : null}
                </>
              )}
            </p>
            <label className="sr-only" htmlFor="reject-reason">
              Reject reason
            </label>
            <input
              id="reject-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REVIEW_NOTE}
              placeholder="Reject reason"
              className="h-9 min-w-[10rem] flex-1 rounded-lg border border-field bg-surface px-3 text-sm sm:max-w-xs"
            />
            <button
              type="button"
              disabled={pending || reason.trim() === ""}
              onClick={() => run(() => rejectFinding(finding.id, reason))}
              className="h-9 rounded-lg border border-bad-fg/40 bg-bad-bg px-4 text-[13px] font-semibold text-bad-fg hover:bg-bad-bg/80 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Saving…" : "Reject card"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveFinding(finding.id, { fields: decisions() }))}
              className="h-9 rounded-lg bg-teal px-4 text-[13px] font-semibold text-white hover:bg-teal-hover disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Saving…" : "Approve and next →"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
