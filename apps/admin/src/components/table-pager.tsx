"use client";

/** Shared Previous/Next pager for catalog-style tables (Cards, Store codes). */
export function TablePager({
  label,
  page,
  pageCount,
  total,
  pageSize,
  noun,
  onPage,
}: {
  label: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  noun: string;
  onPage: (next: number) => void;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const navBtn =
    "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] text-ink hover:bg-teal-soft disabled:opacity-50";

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-[13px] text-body">
        {from}–{to} of {total.toLocaleString("en-CA")} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={navBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="min-w-[5.5rem] text-center text-[13px] tabular-nums text-body">
          {page}/{pageCount}
        </span>
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
