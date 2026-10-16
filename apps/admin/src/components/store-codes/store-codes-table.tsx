"use client";

import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/sources/status-pill";
import {
  certaintyPill,
  evidenceCountLabel,
} from "@/lib/store-codes/present";
import {
  STORE_CODES_PAGE_SIZE,
  type StoreCodeListItem,
} from "@/lib/store-codes/types";

const openBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-field bg-surface px-3 text-sm font-medium text-ink hover:bg-teal-soft";

function StoreCodeRow({ item }: { item: StoreCodeListItem }) {
  const router = useRouter();
  const cert = certaintyPill(item.certainty);
  return (
    <tr className="h-[60px] border-t border-line-soft">
      <th scope="row" className="px-4 py-0 text-left font-semibold">
        {item.name}
      </th>
      <td className="px-2 py-0 font-variant-numeric tabular-nums">{item.code_display}</td>
      <td className="px-2 py-0">{item.category_label}</td>
      <td className="px-2 py-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill {...cert} />
          {item.pending_review ? <StatusPill label="To review" tone="ok" /> : null}
        </div>
      </td>
      <td className="px-2 py-0">{evidenceCountLabel(item.evidence_count)}</td>
      <td className="px-2 py-0 text-body">{item.latest_evidence_label ?? "—"}</td>
      <td className="px-4 py-0 pl-2 text-right">
        <button
          type="button"
          className={openBtn}
          onClick={() => router.push(`/store-codes/${encodeURIComponent(item.id)}`)}
        >
          Open
          <span className="sr-only"> {item.name}</span>
        </button>
      </td>
    </tr>
  );
}

export function StoreCodesTable({
  rows,
  totalUnfiltered,
  emptyBecauseFilter,
  loadError,
}: {
  rows: StoreCodeListItem[];
  totalUnfiltered: number;
  emptyBecauseFilter: boolean;
  loadError: string | null;
}) {
  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Store chains">
      <table className="w-full min-w-[1000px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold tracking-[0.04em] text-body uppercase">
            <th scope="col" className="w-[190px] px-4 py-3">
              Store chain
            </th>
            <th scope="col" className="px-2 py-3">
              Code
            </th>
            <th scope="col" className="px-2 py-3">
              Category
            </th>
            <th scope="col" className="px-2 py-3">
              Certainty
            </th>
            <th scope="col" className="px-2 py-3">
              Evidence
            </th>
            <th scope="col" className="px-2 py-3">
              Latest evidence
            </th>
            <th scope="col" className="px-4 py-3 pl-2 text-right">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <StoreCodeRow key={item.id} item={item} />
          ))}
          {rows.length === 0 && !loadError ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-body">
                {totalUnfiltered === 0
                  ? "No store codes yet. Import research CSV to create findings, then approve them."
                  : emptyBecauseFilter
                    ? "No stores match this search."
                    : "No stores on this page."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="sr-only">
        Page size {STORE_CODES_PAGE_SIZE}. Use the pager below when there are more results.
      </p>
    </div>
  );
}

export function StoreCodesPager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (next: number) => void;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const navBtn =
    "h-9 rounded-lg border border-field bg-surface px-3 text-sm text-ink hover:bg-teal-soft disabled:opacity-50";

  return (
    <nav
      aria-label="Store codes pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-body"
    >
      <p>
        Showing {from}–{to} of {total.toLocaleString("en-CA")}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={navBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className={navBtn}
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
