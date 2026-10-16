"use client";

import { StoreCodeFindingRow } from "@/components/review/store-code-finding-row";
import type { MerchantCodeFinding } from "@/lib/mcc-review/types";

export function StoreCodeEvidenceTable({
  findings,
  canReview,
  pending,
  selected,
  onToggleFinding,
  onApprove,
  onStartReject,
}: {
  findings: MerchantCodeFinding[];
  canReview: boolean;
  pending: boolean;
  selected: Set<string>;
  onToggleFinding: (id: string) => void;
  onApprove: (id: string) => void;
  onStartReject: (id: string) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
            {canReview ? <th className="px-3 py-2" /> : null}
            <th className="px-3 py-2 font-semibold">Proposed</th>
            <th className="px-3 py-2 font-semibold">Source</th>
            <th className="px-3 py-2 font-semibold">Evidence</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Decide</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <StoreCodeFindingRow
              key={f.id}
              finding={f}
              canReview={canReview}
              pending={pending}
              selected={selected.has(f.id)}
              onToggle={() => onToggleFinding(f.id)}
              onApprove={() => onApprove(f.id)}
              onReject={() => onStartReject(f.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
