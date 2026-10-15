"use client";

import { Fragment, useState, useTransition } from "react";
import { approveFinding, rejectFinding, type ReviewResult } from "@/app/(console)/review/actions";
import { StatusPill } from "@/components/sources/status-pill";
import {
  buildFieldRows,
  changedFieldCount,
  DIFF_LABELS,
  failedCheckCount,
  failedChecks,
} from "@/lib/review/present";
import { MAX_REVIEW_NOTE, type PendingFinding } from "@/lib/review/types";
import { displayUrl, formatDate } from "@/lib/sources/present";

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

function FindingDetails({
  finding,
  canReview,
  busy,
  onApprove,
  onReject,
}: {
  finding: PendingFinding;
  canReview: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const rows = buildFieldRows(finding);
  const failed = failedChecks(finding);
  const discontinued = finding.diff_kind === "possibly_discontinued";

  return (
    <div className="flex flex-col gap-4 bg-canvas px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px]">
        {finding.product_url ? (
          <a href={finding.product_url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline">
            {displayUrl(finding.product_url)}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <span className="text-body">No source page (card not found on the issuer site)</span>
        )}
        <span className="text-body">
          Catalog card: {finding.linked_card_id ?? "none (new card)"}
        </span>
      </div>

      {failed.length > 0 ? (
        <div role="note" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm text-bad-fg">
          <p className="font-semibold">
            {failed.length === 1 ? "1 check failed" : `${failed.length} checks failed`}. Verify against the source page
            before approving.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {failed.map((f) => (
              <li key={f.field}>
                {f.field}: {f.issues.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {discontinued ? (
        <p className="rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
          The crawler could not find this catalog card on the issuer&apos;s site. Approving only records that you agree
          it may be discontinued.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-body">No extracted values on this finding.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Proposed values for {finding.card_name ?? "this card"}</caption>
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
                <th scope="col" className="px-4 py-2.5 font-semibold">Field</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Catalog now</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Proposed</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Source quote</th>
                <th scope="col" className="px-4 py-2.5 pl-2 font-semibold">Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-line-soft align-top">
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">{r.label}</th>
                  <td className="px-2 py-2.5 text-body">{r.current ?? "Not in catalog"}</td>
                  <td className={`px-2 py-2.5 ${r.changed ? "font-semibold" : "text-body"}`}>{r.proposed}</td>
                  <td className="max-w-[320px] px-2 py-2.5 text-[13px] text-body italic">
                    {r.quote ? <>&ldquo;{r.quote}&rdquo;</> : "No quote"}
                  </td>
                  <td className="px-4 py-2.5 pl-2 text-[13px]">
                    {r.check === null ? (
                      <span className="text-muted">Not checked</span>
                    ) : r.check.ok ? (
                      <span className="font-semibold text-ok-fg">Passed</span>
                    ) : (
                      <span className="font-semibold text-bad-fg">Failed: {r.check.issues.join("; ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canReview ? (
        rejecting ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onReject(reason);
            }}
          >
            <label htmlFor={`reason-${finding.id}`} className="text-[13px] font-semibold">
              Reason for rejecting (required)
            </label>
            <textarea
              id={`reason-${finding.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REVIEW_NOTE}
              required
              rows={3}
              className="w-full max-w-xl rounded-lg border border-field bg-surface px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || reason.trim() === ""}
                className="h-9 rounded-lg bg-bad-fg px-4 text-[13px] font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Rejecting…" : "Confirm reject"}
              </button>
              <button type="button" className={rowButton} disabled={busy} onClick={() => setRejecting(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="h-9 rounded-lg bg-teal px-4 text-[13px] font-semibold text-white hover:bg-teal-hover disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Saving…" : "Approve"}
            </button>
            <button type="button" className={rowButton} disabled={busy} onClick={() => setRejecting(true)}>
              Reject…
            </button>
          </div>
        )
      ) : (
        <p className="text-[13px] text-body">Read-only: only validators and admins can review findings.</p>
      )}
    </div>
  );
}

export function ReviewConsole({
  findings,
  canReview,
  truncated,
  loadError,
}: {
  findings: PendingFinding[];
  canReview: boolean;
  truncated: boolean;
  loadError: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (id: string, action: () => Promise<ReviewResult>) => {
    setPendingId(id);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      } finally {
        setPendingId(null);
      }
    });
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Review queue</h1>
        <p className="text-[15px] text-body">
          What the crawler found, waiting for a human. Approving records your decision only; nothing here changes the
          card catalog.
        </p>
      </div>

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

      {loadError ? (
        <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
          {loadError}
        </p>
      ) : null}

      <section aria-labelledby="findings-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="findings-heading" className="sr-only">
          Pending findings
        </h2>
        <div className="relative overflow-x-auto" role="region" aria-label="Pending findings table" tabIndex={0}>
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] whitespace-nowrap text-body uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Card</th>
                <th scope="col" className="px-2 py-3 font-semibold">Issuer</th>
                <th scope="col" className="px-2 py-3 font-semibold">Result</th>
                <th scope="col" className="px-2 py-3 font-semibold">Run date</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Fields changed</th>
                <th scope="col" className="px-4 py-3 pl-2 font-semibold">Checks</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => {
                const open = expanded.has(f.id);
                const detailsId = `finding-${f.id}-details`;
                const kind = f.diff_kind ? DIFF_LABELS[f.diff_kind] : null;
                const failures = failedCheckCount(f);
                const name = f.card_name ?? f.linked_card_id ?? "Unnamed card";
                return (
                  <Fragment key={f.id}>
                    <tr className={`border-t border-line-soft ${failures > 0 ? "bg-bad-bg/40" : ""}`}>
                      <th scope="row" className="px-4 py-3 text-left">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={detailsId}
                          onClick={() => toggle(f.id)}
                          className="flex min-h-8 items-center gap-2 rounded text-left text-sm font-semibold text-ink"
                        >
                          <span aria-hidden="true" className="w-3.5 text-body">
                            {open ? "▾" : "▸"}
                          </span>
                          {name}
                        </button>
                      </th>
                      <td className="px-2 py-3 text-body">{f.source?.issuer_name ?? "Unknown"}</td>
                      <td className="px-2 py-3">{kind ? <StatusPill {...kind} /> : <span className="text-muted">Unknown</span>}</td>
                      <td className="px-2 py-3 whitespace-nowrap text-body">
                        {formatDate(f.run?.created_at ?? f.created_at)}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{changedFieldCount(f)}</td>
                      <td className="px-4 py-3 pl-2">
                        {failures > 0 ? (
                          <StatusPill label={failures === 1 ? "1 failed" : `${failures} failed`} tone="bad" />
                        ) : (
                          <span className="text-[13px] text-ok-fg">All passed</span>
                        )}
                      </td>
                    </tr>
                    <tr id={detailsId} hidden={!open}>
                      <td colSpan={6} className="border-t border-line-soft p-0">
                        {open ? (
                          <FindingDetails
                            finding={f}
                            canReview={canReview}
                            busy={pendingId === f.id}
                            onApprove={() => run(f.id, () => approveFinding(f.id))}
                            onReject={(reason) => run(f.id, () => rejectFinding(f.id, reason))}
                          />
                        ) : null}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {findings.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-body">
                    Nothing to review. New findings appear here after a crawler run.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {truncated ? (
        <p className="text-[13px] text-muted">Showing the newest 200 pending findings. Review some to see the rest.</p>
      ) : null}
    </>
  );
}
