"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkApproveMerchantCodeFindings,
  bulkRejectMerchantCodeFindings,
  approveMerchantCodeFinding,
  rejectMerchantCodeFinding,
} from "@/app/(console)/review/mcc-actions";
import { ActionNotice, LoadError } from "@/components/action-feedback";
import { StatusPill } from "@/components/sources/status-pill";
import { ReviewTabs } from "@/components/review/review-tabs";
import {
  certaintyLabel,
  groupFindingsByChain,
  proposedMcc,
  proposedQuote,
  proposedSourceUrl,
  sourceTypeLabel,
  statusLabel,
  type ChainGroup,
} from "@/lib/mcc-review/present";
import { MAX_REVIEW_NOTE, type BrandSnapshot, type MerchantCodeFinding } from "@/lib/mcc-review/types";
import { formatDate } from "@/lib/sources/present";

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:opacity-50";
const primaryButton =
  "h-9 rounded-lg bg-teal px-4 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50";
const dangerButton =
  "h-9 rounded-lg border border-bad-fg/30 bg-bad-bg px-4 text-[13px] font-semibold text-bad-fg hover:opacity-90 disabled:opacity-50";

export function StoreCodesConsole({
  findings,
  brands,
  canReview,
  canImport,
  truncated,
  loadError,
  cardCount,
}: {
  findings: MerchantCodeFinding[];
  brands: BrandSnapshot[];
  canReview: boolean;
  canImport: boolean;
  truncated: boolean;
  loadError: string | null;
  cardCount: number;
}) {
  const router = useRouter();
  const groups = useMemo(() => groupFindingsByChain(findings, brands), [findings, brands]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expanded, setExpanded] = useState<string | null>(groups[0]?.chain.toLowerCase() ?? null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const allIds = findings.map((f) => f.id);
  const selectedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(group: ChainGroup) {
    const ids = group.findings.map((f) => f.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
        if (res.ok) {
          setSelected(new Set());
          setReason("");
          router.refresh();
        }
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      }
    });
  }

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Review queue</h1>
        <p className="text-[15px] text-body">
          Store-code findings from research imports and crawls. Approving updates the chain&apos;s code and
          status immediately and writes each decision to the audit log. A chain becomes Verified only with two
          independent agreeing sources; conflicting codes set Conflict.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReviewTabs active="store-codes" cardCount={cardCount} storeCount={findings.length} />
        {canImport ? (
          <button type="button" className={rowButton} onClick={() => router.push("/review/import")}>
            Import research CSV
          </button>
        ) : null}
      </div>

      <ActionNotice notice={notice} />
      <LoadError message={loadError} />

      {canReview && rejectId ? (
        <section
          aria-labelledby="reject-heading"
          className="rounded-xl border border-line bg-surface px-4 py-3"
        >
          <h2 id="reject-heading" className="text-sm font-semibold">
            Reject finding
          </h2>
          <label className="mt-3 flex max-w-xl flex-col gap-1.5 text-[13px] font-medium">
            Reason for rejecting (required)
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={MAX_REVIEW_NOTE}
              rows={2}
              className="rounded-lg border border-field bg-canvas px-3 py-2 text-[13px] font-normal text-ink"
              disabled={pending}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={dangerButton}
              disabled={pending || rejectReason.trim() === ""}
              onClick={() =>
                run(async () => {
                  const res = await rejectMerchantCodeFinding(rejectId, rejectReason);
                  if (res.ok) {
                    setRejectId(null);
                    setRejectReason("");
                  }
                  return res;
                })
              }
            >
              Confirm reject
            </button>
            <button
              type="button"
              className={rowButton}
              disabled={pending}
              onClick={() => {
                setRejectId(null);
                setRejectReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {canReview && findings.length > 0 ? (
        <section
          aria-labelledby="bulk-heading"
          className="rounded-xl border border-line bg-surface px-4 py-3"
        >
          <h2 id="bulk-heading" className="text-sm font-semibold">
            Bulk review
          </h2>
          <p className="mt-1 text-[13px] text-body">
            Select findings across chains, enter one reason, then approve or reject. Each row is logged
            separately.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={rowButton} onClick={selectAll} disabled={pending}>
              Select all ({findings.length})
            </button>
            <button
              type="button"
              className={rowButton}
              onClick={clearSelection}
              disabled={pending || selectedCount === 0}
            >
              Clear selection
            </button>
            <span className="text-[13px] text-muted tabular-nums">{selectedCount} selected</span>
          </div>
          <label className="mt-3 flex max-w-xl flex-col gap-1.5 text-[13px] font-medium">
            Reason (required for bulk)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REVIEW_NOTE}
              rows={2}
              className="rounded-lg border border-field bg-canvas px-3 py-2 text-[13px] font-normal text-ink"
              disabled={pending}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={pending || selectedCount === 0 || reason.trim() === ""}
              onClick={() =>
                run(() => bulkApproveMerchantCodeFindings([...selected], reason))
              }
            >
              Approve selected
            </button>
            <button
              type="button"
              className={dangerButton}
              disabled={pending || selectedCount === 0 || reason.trim() === ""}
              onClick={() =>
                run(() => bulkRejectMerchantCodeFindings([...selected], reason))
              }
            >
              Reject selected
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="store-findings-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="store-findings-heading" className="sr-only">
          Store-code findings by chain
        </h2>
        {groups.length === 0 && !loadError ? (
          <p className="px-4 py-8 text-center text-body">
            Nothing to review. Import a research CSV or wait for crawler findings.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {groups.map((group) => {
              const key = group.chain.toLowerCase();
              const open = expanded === key;
              const status = statusLabel(group.brand?.status);
              const groupSelected = group.findings.every((f) => selected.has(f.id));
              return (
                <li key={key} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {canReview ? (
                          <input
                            type="checkbox"
                            checked={groupSelected}
                            onChange={() => toggleGroup(group)}
                            aria-label={`Select all findings for ${group.chain}`}
                            disabled={pending}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="text-left text-[15px] font-semibold text-ink"
                          onClick={() => setExpanded(open ? null : key)}
                          aria-expanded={open}
                        >
                          {group.chain}
                        </button>
                        <StatusPill {...status} />
                        {group.brand?.certainty ? (
                          <span className="text-[12px] text-muted">
                            {certaintyLabel(String(group.brand.certainty))}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[13px] text-body">
                        Now:{" "}
                        <span className="font-medium tabular-nums text-ink">
                          {group.currentMcc ?? "—"}
                        </span>
                        {" · "}
                        Proposed:{" "}
                        <span className="font-medium tabular-nums text-ink">
                          {group.proposedMccs.join(", ") || "—"}
                        </span>
                        {" · "}
                        {group.findings.length} pending
                      </p>
                    </div>
                    <button
                      type="button"
                      className={rowButton}
                      onClick={() => setExpanded(open ? null : key)}
                    >
                      {open ? "Hide evidence" : "Review"}
                    </button>
                  </div>

                  {open ? (
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
                          {group.findings.map((f) => (
                            <FindingRow
                              key={f.id}
                              finding={f}
                              canReview={canReview}
                              pending={pending}
                              selected={selected.has(f.id)}
                              onToggle={() => toggle(f.id)}
                              onApprove={() =>
                                run(() => approveMerchantCodeFinding(f.id, reason || null))
                              }
                              onReject={() => {
                                setRejectId(f.id);
                                setRejectReason(reason);
                              }}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {truncated ? (
        <p className="text-[13px] text-muted">
          Showing the newest {findings.length} pending store-code findings. Review some to see the rest.
        </p>
      ) : null}
    </>
  );
}

function FindingRow({
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
  const sourceType =
    typeof finding.proposed.source_type === "string"
      ? finding.proposed.source_type
      : finding.kind === "test_purchase"
        ? "test_purchase"
        : null;

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
        <div>{sourceTypeLabel(sourceType)}</div>
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
      <td className="px-3 py-3 whitespace-nowrap text-body">
        {formatDate(
          typeof finding.proposed.observed_date === "string"
            ? finding.proposed.observed_date
            : typeof finding.proposed.date === "string"
              ? finding.proposed.date
              : finding.created_at,
        )}
      </td>
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
