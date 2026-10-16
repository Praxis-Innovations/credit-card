"use client";

import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/sources/status-pill";
import { catalogStatusPill, imageRightsLabel } from "@/lib/cards/present";
import { CARDS_PAGE_SIZE, type CatalogCardListItem } from "@/lib/cards/types";
import { formatDate } from "@/lib/sources/present";

const openBtn =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft";

function CardRow({ card }: { card: CatalogCardListItem }) {
  const router = useRouter();
  const pill = catalogStatusPill(card.status);
  return (
    <tr className="border-t border-line-soft">
      <th scope="row" className="px-4 py-3 text-left font-semibold">
        <div className="flex flex-col gap-1">
          <span className="line-clamp-2">{card.name}</span>
          <div className="flex flex-wrap gap-1.5">
            {card.pending_change ? <StatusPill label="Pending change" tone="warn" /> : null}
            {!card.has_crawl_source ? <StatusPill label="No crawl source yet" tone="neutral" /> : null}
          </div>
        </div>
      </th>
      <td className="px-2 py-3 text-body">{card.issuer}</td>
      <td className="px-2 py-3">
        <StatusPill {...pill} />
      </td>
      <td className="px-2 py-3 text-body">{card.network ?? "—"}</td>
      <td className="px-2 py-3 text-body">{imageRightsLabel(card.image_rights_status)}</td>
      <td className="px-2 py-3 whitespace-nowrap text-body">{formatDate(card.last_verified)}</td>
      <td className="px-4 py-3 pl-2 text-right">
        <button
          type="button"
          className={openBtn}
          onClick={() => router.push(`/cards/${encodeURIComponent(card.id)}`)}
        >
          Open
          <span className="sr-only"> {card.name}</span>
        </button>
      </td>
    </tr>
  );
}

export function CardsTable({
  rows,
  totalUnfiltered,
  emptyBecauseFilter,
  loadError,
}: {
  rows: CatalogCardListItem[];
  totalUnfiltered: number;
  emptyBecauseFilter: boolean;
  loadError: string | null;
}) {
  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label="Catalog cards">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold tracking-[0.05em] text-body uppercase">
            <th scope="col" className="px-4 py-3">
              Card
            </th>
            <th scope="col" className="px-2 py-3">
              Issuer
            </th>
            <th scope="col" className="px-2 py-3">
              Status
            </th>
            <th scope="col" className="px-2 py-3">
              Network
            </th>
            <th scope="col" className="px-2 py-3">
              Image
            </th>
            <th scope="col" className="px-2 py-3">
              Last verified
            </th>
            <th scope="col" className="px-4 py-3 pl-2 text-right">
              Open
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
          {rows.length === 0 && !loadError ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-body">
                {totalUnfiltered === 0
                  ? "No cards in the catalog yet."
                  : emptyBecauseFilter
                    ? "No cards match this search."
                    : "No cards on this page."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="sr-only">
        Page size {CARDS_PAGE_SIZE}. Use the pager below when there are more results.
      </p>
    </div>
  );
}
