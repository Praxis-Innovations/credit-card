"use client";

import { StatusPill } from "@/components/sources/status-pill";
import { DIFF_LABELS, type FieldRow } from "@/lib/review/present";
import { MAX_REVIEW_NOTE, type PendingFinding } from "@/lib/review/types";
import { formatDate } from "@/lib/sources/present";
import { barButton, FieldsTable, type FieldEditors, type FieldState } from "./review-field-table";

type NavProps = {
  index: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  pending: boolean;
  onQueue: () => void;
  onGo: (id: string) => void;
};

export function ReviewQueueNav({ index, total, previousId, nextId, pending, onQueue, onGo }: NavProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={barButton} onClick={onQueue}>
        ← Queue
      </button>
      {total > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-body tabular-nums">
            Card {index + 1} of {total}
          </span>
          <button
            type="button"
            className={barButton}
            disabled={!previousId || pending}
            onClick={() => previousId && onGo(previousId)}
          >
            Previous
          </button>
          <button
            type="button"
            className={barButton}
            disabled={!nextId || pending}
            onClick={() => nextId && onGo(nextId)}
          >
            Skip
          </button>
        </div>
      ) : (
        <span className="text-[13px] text-body">Not in the pending queue</span>
      )}
    </div>
  );
}

export function ReviewCardHeader({
  finding,
  name,
  failedCount,
}: {
  finding: PendingFinding;
  name: string;
  failedCount: number;
}) {
  const kind = finding.diff_kind ? DIFF_LABELS[finding.diff_kind] : null;
  return (
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
      {finding.diff_kind === "new" ? (
        <p role="note" className="mt-3 rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
          Is this a separate card? Approving writes the saved field values to the live catalog immediately.
        </p>
      ) : null}
      {finding.diff_kind === "possibly_discontinued" ? (
        <p role="note" className="mt-3 rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
          The crawler could not find this catalog card on the issuer&apos;s site. Approving only records that you agree
          it may be discontinued.
        </p>
      ) : null}
      {failedCount > 0 ? (
        <p role="note" className="mt-3 rounded-lg bg-bad-bg px-4 py-2.5 text-sm text-bad-fg">
          {failedCount === 1 ? "1 check failed" : `${failedCount} checks failed`}. Verify against the source page before
          approving.
        </p>
      ) : null}
    </header>
  );
}

type SectionProps = {
  id: string;
  title: string;
  tone: "warn" | "neutral";
  rows: FieldRow[];
  name: string;
  states: Record<string, FieldState>;
  canReview: boolean;
  isLive: boolean;
  editors: FieldEditors;
};

export function FieldSection({ id, title, tone, rows, name, states, canReview, isLive, editors }: SectionProps) {
  if (rows.length === 0) return null;
  const headingId = `${id}-heading`;
  const table = (
    <FieldsTable
      caption={`${title} for ${name}`}
      rows={rows}
      states={states}
      canReview={canReview}
      isLive={isLive}
      editors={editors}
    />
  );
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 id={headingId} className={`text-[15px] font-semibold ${tone === "warn" ? "text-warn-fg" : ""}`}>
          {title}
        </h2>
        <span className="text-[13px] text-body">{rows.length}</span>
      </div>
      {tone === "warn" ? (
        <div className="rounded-xl border border-warn-fg/20 bg-warn-bg/40 p-2 sm:p-3">{table}</div>
      ) : (
        table
      )}
    </section>
  );
}

type BarProps = {
  fieldCount: number;
  savedCount: number;
  editedCount: number;
  reason: string;
  pending: boolean;
  onReason: (value: string) => void;
  onReject: () => void;
  onApprove: () => void;
};

export function ReviewDecisionBar({
  fieldCount,
  savedCount,
  editedCount,
  reason,
  pending,
  onReason,
  onReject,
  onApprove,
}: BarProps) {
  const summary =
    fieldCount === 0
      ? "No fields to save"
      : `${savedCount} of ${fieldCount} fields will be saved${editedCount > 0 ? ` · ${editedCount} edited` : ""}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm lg:left-[264px]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <p className="min-w-[12rem] flex-1 text-[13px] font-medium text-body">{summary}</p>
        <label className="sr-only" htmlFor="reject-reason">
          Reject reason
        </label>
        <input
          id="reject-reason"
          type="text"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          maxLength={MAX_REVIEW_NOTE}
          placeholder="Reject reason"
          className="h-9 min-w-[10rem] flex-1 rounded-lg border border-field bg-surface px-3 text-sm sm:max-w-xs"
        />
        <button
          type="button"
          disabled={pending || reason.trim() === ""}
          onClick={onReject}
          className="h-9 rounded-lg border border-bad-fg/40 bg-bad-bg px-4 text-[13px] font-semibold text-bad-fg hover:bg-bad-bg/80 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Reject card"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="h-9 rounded-lg bg-teal px-4 text-[13px] font-semibold text-white hover:bg-teal-hover disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Approve and next →"}
        </button>
      </div>
    </div>
  );
}
