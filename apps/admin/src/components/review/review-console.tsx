"use client";

import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/sources/status-pill";
import { buildFieldRows, changedFieldCount, DIFF_LABELS, failedCheckCount } from "@/lib/review/present";
import type { PendingFinding } from "@/lib/review/types";
import { formatDate } from "@/lib/sources/present";

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft";

export function ReviewConsole({
  findings,
  canReview,
  truncated,
  loadError,
  checkedBannerCount,
}: {
  findings: PendingFinding[];
  canReview: boolean;
  truncated: boolean;
  loadError: string | null;
  /** Optional count of unchanged cards kept out of this queue (CR1). */
  checkedBannerCount?: number | null;
}) {
  const router = useRouter();

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Review queue</h1>
        <p className="text-[15px] text-body">
          New, changed and possibly discontinued cards the crawler found, waiting for a human. Cards that match the
          catalog are recorded as checked and don&apos;t appear here. Open a card to correct values and choose which
          fields to save — nothing here changes the live catalog until a later promote step.
        </p>
      </div>

      {typeof checkedBannerCount === "number" && checkedBannerCount > 0 ? (
        <p role="status" className="rounded-lg bg-ok-bg px-4 py-2.5 text-sm text-ok-fg">
          {checkedBannerCount} card{checkedBannerCount === 1 ? "" : "s"} matched the live catalog and{" "}
          {checkedBannerCount === 1 ? "was" : "were"} recorded as checked and kept out of this queue.
        </p>
      ) : null}

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
                <th scope="col" className="px-4 py-3 font-semibold">
                  Card
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Issuer
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Result
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Run date
                </th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">
                  Fields changed
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Checks
                </th>
                <th scope="col" className="px-4 py-3 pl-2 font-semibold">
                  Review
                </th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => {
                const kind = f.diff_kind ? DIFF_LABELS[f.diff_kind] : null;
                const failures = failedCheckCount(f);
                const name = f.card_name ?? f.linked_card_id ?? "Unnamed card";
                const fields = buildFieldRows(f).length;
                return (
                  <tr key={f.id} className={`border-t border-line-soft ${failures > 0 ? "bg-bad-bg/40" : ""}`}>
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {name}
                    </th>
                    <td className="px-2 py-3 text-body">{f.source?.issuer_name ?? "Unknown"}</td>
                    <td className="px-2 py-3">
                      {kind ? <StatusPill {...kind} /> : <span className="text-muted">Unknown</span>}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-body">
                      {formatDate(f.run?.created_at ?? f.created_at)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{changedFieldCount(f)}</td>
                    <td className="px-2 py-3">
                      {failures > 0 ? (
                        <StatusPill label={failures === 1 ? "1 failed" : `${failures} failed`} tone="bad" />
                      ) : (
                        <span className="text-[13px] text-ok-fg">All passed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 pl-2">
                      <button
                        type="button"
                        className={rowButton}
                        onClick={() => router.push(`/review/${f.id}`)}
                      >
                        {canReview ? "Review" : "View"}
                        <span className="sr-only">
                          {" "}
                          {name}
                          {fields > 0 ? ` (${fields} fields)` : ""}
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {findings.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-body">
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
