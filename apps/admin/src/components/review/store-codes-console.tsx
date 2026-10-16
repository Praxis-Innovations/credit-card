"use client";

import { useRouter } from "next/navigation";
import { ActionNotice, LoadError } from "@/components/action-feedback";
import { ReviewTabs } from "@/components/review/review-tabs";
import { StoreCodeBulkBar, StoreCodeRejectBar } from "@/components/review/store-code-bulk-bar";
import { StoreCodeChainGroup } from "@/components/review/store-code-chain-group";
import { rowButton } from "@/components/review/mcc-buttons";
import { useStoreCodeReview } from "@/components/review/use-store-code-review";
import type { BrandSnapshot, MerchantCodeFinding } from "@/lib/mcc-review/types";

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
  const review = useStoreCodeReview(findings, brands);

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Review queue</h1>
        <p className="text-[15px] text-body">
          Store-code findings from research imports and crawls. Approving updates the chain&apos;s code and status
          immediately and writes each decision to the audit log. A chain becomes Verified only with two independent
          agreeing sources; conflicting codes set Conflict.
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

      <ActionNotice notice={review.notice} />
      <LoadError message={loadError} />

      {canReview && review.rejectId ? (
        <StoreCodeRejectBar
          reason={review.rejectReason}
          pending={review.pending}
          onReason={review.setRejectReason}
          onConfirm={review.confirmReject}
          onCancel={review.cancelReject}
        />
      ) : null}

      {canReview && findings.length > 0 ? (
        <StoreCodeBulkBar
          findingCount={findings.length}
          selectedCount={review.selected.size}
          reason={review.reason}
          pending={review.pending}
          onReason={review.setReason}
          onSelectAll={review.selectAll}
          onClear={review.clearSelection}
          onApprove={review.bulkApprove}
          onReject={review.bulkReject}
        />
      ) : null}

      <StoreCodeFindingsList review={review} canReview={canReview} loadError={loadError} />

      {truncated ? (
        <p className="text-[13px] text-muted">
          Showing the newest {findings.length} pending store-code findings. Review some to see the rest.
        </p>
      ) : null}
    </>
  );
}

function StoreCodeFindingsList({
  review,
  canReview,
  loadError,
}: {
  review: ReturnType<typeof useStoreCodeReview>;
  canReview: boolean;
  loadError: string | null;
}) {
  return (
    <section aria-labelledby="store-findings-heading" className="rounded-xl border border-line bg-surface">
      <h2 id="store-findings-heading" className="sr-only">
        Store-code findings by chain
      </h2>
      {review.groups.length === 0 && !loadError ? (
        <p className="px-4 py-8 text-center text-body">
          Nothing to review. Import a research CSV or wait for crawler findings.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {review.groups.map((group) => {
            const key = group.chain.toLowerCase();
            return (
              <StoreCodeChainGroup
                key={key}
                group={group}
                open={review.expanded === key}
                canReview={canReview}
                pending={review.pending}
                selected={review.selected}
                onToggleExpand={() => review.setExpanded(review.expanded === key ? null : key)}
                onToggleGroup={() => review.toggleGroup(group)}
                onToggleFinding={review.toggle}
                onApprove={review.approveOne}
                onStartReject={review.startReject}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
