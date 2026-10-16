"use client";

import { useMemo, useState } from "react";
import { LoadError } from "@/components/action-feedback";
import { filterCards, uniqueIssuers } from "@/lib/cards/present";
import {
  CARDS_PAGE_SIZE,
  type CardStatusFilter,
  type CatalogCardListItem,
} from "@/lib/cards/types";
import { TablePager } from "@/components/table-pager";
import { CardsFilters } from "./cards-filters";
import { CardsTable } from "./cards-table";

export function CardsConsole({
  cards,
  loadError,
}: {
  cards: CatalogCardListItem[];
  loadError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState("");
  const [status, setStatus] = useState<CardStatusFilter>("all");
  const [page, setPage] = useState(1);

  const issuers = useMemo(() => uniqueIssuers(cards), [cards]);
  const filtered = useMemo(
    () => filterCards(cards, { query, issuer, status }),
    [cards, query, issuer, status],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / CARDS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * CARDS_PAGE_SIZE, safePage * CARDS_PAGE_SIZE);

  const bumpFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Cards</h1>
        <p className="text-[15px] text-body">
          The live catalog. Open a card to see its values, source quotes and history. Values change only through
          the review queue.
        </p>
      </div>

      <LoadError message={loadError} />

      <CardsFilters
        query={query}
        issuer={issuer}
        status={status}
        issuers={issuers}
        onQuery={bumpFilter(setQuery)}
        onIssuer={bumpFilter(setIssuer)}
        onStatus={bumpFilter(setStatus)}
      />

      <section aria-labelledby="cards-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="cards-heading" className="sr-only">
          Catalog cards
        </h2>
        <CardsTable
          rows={pageRows}
          totalUnfiltered={cards.length}
          emptyBecauseFilter={filtered.length === 0 && cards.length > 0}
          loadError={loadError}
        />
        <TablePager
          label="Cards pages"
          noun="cards"
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={CARDS_PAGE_SIZE}
          onPage={setPage}
        />
      </section>
    </>
  );
}
