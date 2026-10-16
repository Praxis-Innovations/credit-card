"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
  type TransitionStartFunction,
} from "react";
import { approveFinding, rejectFinding, type ReviewResult } from "@/app/(console)/review/actions";
import { buildFieldRows, failedChecks, splitFieldRows, type FieldRow } from "@/lib/review/present";
import type { FieldDecision, PendingFinding } from "@/lib/review/types";
import {
  FieldSection,
  ReviewCardHeader,
  ReviewDecisionBar,
  ReviewQueueNav,
} from "./review-card-chrome";
import type { FieldEditors, FieldState } from "./review-field-table";

function initialStates(rows: FieldRow[]): Record<string, FieldState> {
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.proposed, save: true }]));
}

function toDecisions(rows: FieldRow[], states: Record<string, FieldState>): FieldDecision[] {
  return rows.map((r) => ({
    key: r.key,
    save: states[r.key]?.save ?? true,
    page_value: r.proposed,
    value: states[r.key]?.value ?? r.proposed,
  }));
}

function fieldEditors(
  rows: FieldRow[],
  setStates: Dispatch<SetStateAction<Record<string, FieldState>>>,
): FieldEditors {
  return {
    onValue: (key, value) => setStates((s) => ({ ...s, [key]: { ...s[key]!, value } })),
    onUndo: (key) => {
      const row = rows.find((r) => r.key === key);
      if (!row) return;
      setStates((s) => ({ ...s, [key]: { ...s[key]!, value: row.proposed } }));
    },
    onSave: (key, save) => setStates((s) => ({ ...s, [key]: { ...s[key]!, save } })),
  };
}

function runDecision(
  action: () => Promise<ReviewResult>,
  setNotice: Dispatch<SetStateAction<{ ok: boolean; message: string } | null>>,
  startTransition: TransitionStartFunction,
  go: (nextId: string | null) => void,
) {
  setNotice(null);
  // Pass the async work to startTransition so pending stays true until it settles.
  startTransition(async () => {
    try {
      const res = await action();
      setNotice({ ok: res.ok, message: res.message });
      if (res.ok) go(res.nextId);
    } catch {
      setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
    }
  });
}

type CardProps = {
  finding: PendingFinding;
  index: number;
  total: number;
  previousId: string | null;
  nextId: string | null;
  canReview: boolean;
};

function ReviewCardBody({
  finding,
  name,
  rows,
  needsLook,
  looksRight,
  states,
  editors,
  canReview,
  isLive,
  notice,
}: {
  finding: PendingFinding;
  name: string;
  rows: FieldRow[];
  needsLook: FieldRow[];
  looksRight: FieldRow[];
  states: Record<string, FieldState>;
  editors: FieldEditors;
  canReview: boolean;
  isLive: boolean;
  notice: { ok: boolean; message: string } | null;
}) {
  return (
    <>
      <ReviewCardHeader finding={finding} name={name} failedCount={failedChecks(finding).length} />
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
      {rows.length === 0 && finding.diff_kind !== "possibly_discontinued" ? (
        <p className="text-sm text-body">No extracted values on this finding.</p>
      ) : null}
      <FieldSection
        id="needs-look"
        title="Needs a look"
        tone="warn"
        rows={needsLook}
        name={name}
        states={states}
        canReview={canReview}
        isLive={isLive}
        editors={editors}
      />
      <FieldSection
        id="looks-right"
        title="Looks right"
        tone="neutral"
        rows={looksRight}
        name={name}
        states={states}
        canReview={canReview}
        isLive={isLive}
        editors={editors}
      />
    </>
  );
}

export function ReviewCard({ finding, index, total, previousId, nextId, canReview }: CardProps) {
  const router = useRouter();
  const rows = useMemo(() => buildFieldRows(finding), [finding]);
  const { needsLook, looksRight } = useMemo(() => splitFieldRows(rows), [rows]);
  const [states, setStates] = useState(() => initialStates(rows));
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const editors = fieldEditors(rows, setStates);
  const name = finding.card_name ?? finding.linked_card_id ?? "Unnamed card";
  const go = (id: string | null) => {
    router.push(id ? `/review/${id}` : "/review");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <ReviewQueueNav
        index={index}
        total={total}
        previousId={previousId}
        nextId={nextId}
        pending={pending}
        onQueue={() => router.push("/review")}
        onGo={(id) => router.push(`/review/${id}`)}
      />
      <ReviewCardBody
        finding={finding}
        name={name}
        rows={rows}
        needsLook={needsLook}
        looksRight={looksRight}
        states={states}
        editors={editors}
        canReview={canReview}
        isLive={Boolean(finding.linked_card_id) && finding.diff_kind !== "new"}
        notice={notice}
      />
      {canReview ? (
        <ReviewDecisionBar
          fieldCount={rows.length}
          savedCount={rows.filter((r) => states[r.key]?.save !== false).length}
          editedCount={rows.filter((r) => states[r.key]?.value !== r.proposed).length}
          reason={reason}
          pending={pending}
          onReason={setReason}
          onReject={() => runDecision(() => rejectFinding(finding.id, reason), setNotice, startTransition, go)}
          onApprove={() =>
            runDecision(
              () => approveFinding(finding.id, { fields: toDecisions(rows, states) }),
              setNotice,
              startTransition,
              go,
            )
          }
        />
      ) : null}
    </div>
  );
}
