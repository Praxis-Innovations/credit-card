"use client";

import { StatusPill } from "@/components/sources/status-pill";
import { StoreCodeEvidenceTable } from "@/components/review/store-code-evidence-table";
import { rowButton } from "@/components/review/mcc-buttons";
import { certaintyLabel, statusLabel, type ChainGroup } from "@/lib/mcc-review/present";

export function StoreCodeChainGroup(props: {
  group: ChainGroup;
  open: boolean;
  canReview: boolean;
  pending: boolean;
  selected: Set<string>;
  onToggleExpand: () => void;
  onToggleGroup: () => void;
  onToggleFinding: (id: string) => void;
  onApprove: (id: string) => void;
  onStartReject: (id: string) => void;
}) {
  const { group, open, canReview, pending, selected, onToggleExpand, onToggleGroup } = props;
  const status = statusLabel(group.brand?.status);
  const allSelected = group.findings.every((f) => selected.has(f.id));

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {canReview ? (
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleGroup}
                aria-label={`Select all findings for ${group.chain}`}
                disabled={pending}
              />
            ) : null}
            <button
              type="button"
              className="text-left text-[15px] font-semibold text-ink"
              onClick={onToggleExpand}
              aria-expanded={open}
            >
              {group.chain}
            </button>
            <StatusPill {...status} />
            {group.brand?.certainty ? (
              <span className="text-[12px] text-muted">{certaintyLabel(String(group.brand.certainty))}</span>
            ) : null}
          </div>
          <p className="text-[13px] text-body">
            Now: <span className="font-medium tabular-nums text-ink">{group.currentMcc ?? "—"}</span>
            {" · "}Proposed:{" "}
            <span className="font-medium tabular-nums text-ink">{group.proposedMccs.join(", ") || "—"}</span>
            {" · "}
            {group.findings.length} pending
          </p>
        </div>
        <button type="button" className={rowButton} onClick={onToggleExpand}>
          {open ? "Hide evidence" : "Review"}
        </button>
      </div>
      {open ? (
        <StoreCodeEvidenceTable
          findings={group.findings}
          canReview={canReview}
          pending={pending}
          selected={selected}
          onToggleFinding={props.onToggleFinding}
          onApprove={props.onApprove}
          onStartReject={props.onStartReject}
        />
      ) : null}
    </li>
  );
}
