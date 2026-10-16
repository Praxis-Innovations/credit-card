"use client";

import { dangerButton, primaryButton, rowButton } from "@/components/review/mcc-buttons";
import { proposedMcc, proposedQuote, proposedSourceUrl, sourceTypeLabel } from "@/lib/mcc-review/present";
import type { MerchantCodeFinding } from "@/lib/mcc-review/types";
import { formatDate } from "@/lib/sources/present";

function findingWhen(finding: MerchantCodeFinding): string {
  const p = finding.proposed;
  if (typeof p.observed_date === "string") return p.observed_date;
  if (typeof p.date === "string") return p.date;
  return finding.created_at;
}

function findingSourceType(finding: MerchantCodeFinding): string | null {
  if (typeof finding.proposed.source_type === "string") return finding.proposed.source_type;
  return finding.kind === "test_purchase" ? "test_purchase" : null;
}

export function StoreCodeFindingRow({
  finding,
  canReview,
  pending,
  selected,
  onToggle,
  onApprove,
  onReject,
}: {
  finding: MerchantCodeFinding;
  canReview: boolean;
  pending: boolean;
  selected: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const mcc = proposedMcc(finding);
  const quote = proposedQuote(finding);
  const url = proposedSourceUrl(finding);

  return (
    <tr className="border-t border-line-soft align-top">
      {canReview ? (
        <td className="px-3 py-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select finding ${mcc ?? finding.id}`}
            disabled={pending}
          />
        </td>
      ) : null}
      <td className="px-3 py-3">
        <div className="font-semibold tabular-nums">{mcc ?? "—"}</div>
        <div className="text-[12px] text-muted capitalize">{finding.kind.replaceAll("_", " ")}</div>
      </td>
      <td className="px-3 py-3 text-body">
        <div>{sourceTypeLabel(findingSourceType(finding))}</div>
        {url ? (
          <button
            type="button"
            className={`${rowButton} mt-1`}
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            Open source
          </button>
        ) : null}
      </td>
      <td className="px-3 py-3 text-body">
        {quote ? <q className="text-[13px]">{quote}</q> : <span className="text-muted">No quote</span>}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-body">{formatDate(findingWhen(finding))}</td>
      <td className="px-3 py-3">
        {canReview ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={pending} onClick={onApprove}>
              Approve
            </button>
            <button type="button" className={dangerButton} disabled={pending} onClick={onReject}>
              Reject
            </button>
          </div>
        ) : (
          <span className="text-[13px] text-muted">View only</span>
        )}
      </td>
    </tr>
  );
}
