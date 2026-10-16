"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadError } from "@/components/action-feedback";
import { StatusPill } from "@/components/sources/status-pill";
import {
  catalogStatusPill,
  filterCards,
  imageRightsLabel,
  uniqueIssuers,
} from "@/lib/cards/present";
import {
  CARDS_PAGE_SIZE,
  CARD_STATUS_FILTERS,
  type CardStatusFilter,
  type CatalogCardListItem,
} from "@/lib/cards/types";
import { formatDate } from "@/lib/sources/present";

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50";

const filterControl =
  "h-10 rounded-lg border border-field bg-surface px-2.5 text-sm text-ink";

export function CardsConsole({
  cards,
  loadError,
}: {
  cards: CatalogCardListItem[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState("");
  const [statusFilter, setStatusFilter] = useState<CardStatusFilter>("all");
  const [page, setPage] = useState(1);

  const issuers = useMemo(() => uniqueIssuers(cards), [cards]);

  const filtered = useMemo(
    () => filterCards(cards, { query, issuer, status: statusFilter }),
    [cards, query, issuer, statusFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / CARDS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * CARDS_PAGE_SIZE, safePage * CARDS_PAGE_SIZE);

  const resetPage = () => setPage(1);

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

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label htmlFor="cards-search" className="text-[13px] text-body">
            Search
          </label>
          <input
            id="cards-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Card name or id"
            className={filterControl}
          />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label htmlFor="cards-issuer" className="text-[13px] text-body">
            Issuer
          </label>
          <input
            id="cards-issuer"
            type="search"
            list="cards-issuer-options"
            value={issuer}
            onChange={(e) => {
              setIssuer(e.target.value);
              resetPage();
            }}
            placeholder="Type to search issuers"
            className={filterControl}
            autoComplete="off"
          />
          <datalist id="cards-issuer-options">
            {issuers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cards-status" className="text-[13px] text-body">
            Status
          </label>
          <select
            id="cards-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CardStatusFilter);
              resetPage();
            }}
            className={filterControl}
          >
            {CARD_STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section aria-labelledby="cards-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="cards-heading" className="sr-only">
          Catalog cards
        </h2>
        <div className="relative overflow-x-auto" role="region" aria-label="Cards table" tabIndex={0}>
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] whitespace-nowrap text-body uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Card
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Issuer
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Network
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Image
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Last verified
                </th>
                <th scope="col" className="px-4 py-3 pl-2 text-right font-semibold">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => {
                const pill = catalogStatusPill(c.status);
                return (
                  <tr key={c.id} className="border-t border-line-soft">
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2">{c.name}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {c.pending_change ? (
                            <StatusPill label="Pending change" tone="warn" />
                          ) : null}
                          {!c.has_crawl_source ? (
                            <StatusPill label="No crawl source yet" tone="neutral" />
                          ) : null}
                        </div>
                      </div>
                    </th>
                    <td className="px-2 py-3 text-body">{c.issuer}</td>
                    <td className="px-2 py-3">
                      <StatusPill {...pill} />
                    </td>
                    <td className="px-2 py-3 text-body">{c.network ?? "—"}</td>
                    <td className="px-2 py-3 text-body">{imageRightsLabel(c.image_rights_status)}</td>
                    <td className="px-2 py-3 whitespace-nowrap text-body">
                      {formatDate(c.last_verified)}
                    </td>
                    <td className="px-4 py-3 pl-2 text-right">
                      <button
                        type="button"
                        className={rowButton}
                        onClick={() => router.push(`/cards/${encodeURIComponent(c.id)}`)}
                      >
                        Open
                        <span className="sr-only"> {c.name}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-body">
                    {cards.length === 0
                      ? "No cards in the catalog yet."
                      : "No cards match this search."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filtered.length > CARDS_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[13px] text-body">
              Showing {(safePage - 1) * CARDS_PAGE_SIZE + 1}–
              {Math.min(safePage * CARDS_PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={rowButton}
                disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
              >
                Previous
              </button>
              <span className="px-2 text-[13px] text-body">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                className={rowButton}
                disabled={safePage >= pageCount}
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
