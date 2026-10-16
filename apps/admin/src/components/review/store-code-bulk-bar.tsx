"use client";

import { dangerButton, primaryButton, rowButton } from "@/components/review/mcc-buttons";
import { MAX_REVIEW_NOTE } from "@/lib/mcc-review/types";

function ReasonField({
  label,
  value,
  pending,
  onChange,
}: {
  label: string;
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 flex max-w-xl flex-col gap-1.5 text-[13px] font-medium">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_REVIEW_NOTE}
        rows={2}
        className="rounded-lg border border-field bg-canvas px-3 py-2 text-[13px] font-normal text-ink"
        disabled={pending}
      />
    </label>
  );
}

export function StoreCodeBulkBar({
  findingCount,
  selectedCount,
  reason,
  pending,
  onReason,
  onSelectAll,
  onClear,
  onApprove,
  onReject,
}: {
  findingCount: number;
  selectedCount: number;
  reason: string;
  pending: boolean;
  onReason: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ready = !pending && selectedCount > 0 && reason.trim() !== "";
  return (
    <section aria-labelledby="bulk-heading" className="rounded-xl border border-line bg-surface px-4 py-3">
      <h2 id="bulk-heading" className="text-sm font-semibold">
        Bulk review
      </h2>
      <p className="mt-1 text-[13px] text-body">
        Select findings across chains, enter one reason, then approve or reject. Each row is logged separately.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={rowButton} onClick={onSelectAll} disabled={pending}>
          Select all ({findingCount})
        </button>
        <button type="button" className={rowButton} onClick={onClear} disabled={pending || selectedCount === 0}>
          Clear selection
        </button>
        <span className="text-[13px] text-muted tabular-nums">{selectedCount} selected</span>
      </div>
      <ReasonField label="Reason (required for bulk)" value={reason} pending={pending} onChange={onReason} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={!ready} onClick={onApprove}>
          Approve selected
        </button>
        <button type="button" className={dangerButton} disabled={!ready} onClick={onReject}>
          Reject selected
        </button>
      </div>
    </section>
  );
}

export function StoreCodeRejectBar({
  reason,
  pending,
  onReason,
  onConfirm,
  onCancel,
}: {
  reason: string;
  pending: boolean;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-labelledby="reject-heading" className="rounded-xl border border-line bg-surface px-4 py-3">
      <h2 id="reject-heading" className="text-sm font-semibold">
        Reject finding
      </h2>
      <ReasonField
        label="Reason for rejecting (required)"
        value={reason}
        pending={pending}
        onChange={onReason}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={dangerButton}
          disabled={pending || reason.trim() === ""}
          onClick={onConfirm}
        >
          Confirm reject
        </button>
        <button type="button" className={rowButton} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
