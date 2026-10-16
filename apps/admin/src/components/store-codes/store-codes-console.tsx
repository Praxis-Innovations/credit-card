"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadError } from "@/components/action-feedback";
import { certaintyCounts, filterStoreCodes } from "@/lib/store-codes/present";
import {
  STORE_CODES_PAGE_SIZE,
  type CertaintyFilter,
  type StoreCodeListItem,
} from "@/lib/store-codes/types";
import { TablePager } from "@/components/table-pager";
import { CertaintyChips, StoreCodesSearchFilters } from "./store-codes-filters";
import { StoreCodesTable } from "./store-codes-table";

const headerBtn =
  "h-11 rounded-[10px] border border-field bg-surface px-4 text-[15px] font-medium text-ink hover:bg-teal-soft";

export function StoreCodesConsole({
  items,
  loadError,
}: {
  items: StoreCodeListItem[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [certainty, setCertainty] = useState<CertaintyFilter>("all");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => certaintyCounts(items), [items]);
  const filtered = useMemo(
    () => filterStoreCodes(items, { query, category, certainty }),
    [items, query, category, certainty],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / STORE_CODES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * STORE_CODES_PAGE_SIZE,
    safePage * STORE_CODES_PAGE_SIZE,
  );

  const bumpFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex max-w-xl flex-col gap-1.5">
          <h1 className="font-display text-[30px] leading-tight font-semibold">Store codes</h1>
          <p className="text-[15px] text-body">
            The merchant category code (MCC) each store chain uses at the card terminal. The app states a
            code as fact only when it is Confirmed; every other label is shown to users as uncertain.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className={headerBtn}
            onClick={() => router.push("/review/import")}
          >
            Import research CSV
          </button>
        </div>
      </div>

      <LoadError message={loadError} />

      <CertaintyChips value={certainty} counts={counts} onChange={bumpFilter(setCertainty)} />

      <StoreCodesSearchFilters
        query={query}
        category={category}
        onQuery={bumpFilter(setQuery)}
        onCategory={bumpFilter(setCategory)}
      />

      <section aria-label="Store chains" className="overflow-hidden rounded-xl border border-line bg-surface">
        <StoreCodesTable
          rows={pageRows}
          totalUnfiltered={items.length}
          emptyBecauseFilter={filtered.length === 0 && items.length > 0}
          loadError={loadError}
        />
        <TablePager
          label="Store codes pages"
          noun="stores"
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={STORE_CODES_PAGE_SIZE}
          onPage={setPage}
        />
      </section>
    </>
  );
}
