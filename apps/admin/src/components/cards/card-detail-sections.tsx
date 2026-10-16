"use client";

import { StatusPill } from "@/components/sources/status-pill";
import { auditActionLabel, catalogStatusPill, type CatalogFieldRow } from "@/lib/cards/present";
import type { CardAuditEntry, CatalogCardListItem } from "@/lib/cards/types";
import { formatDate, formatDateTime } from "@/lib/sources/present";

const barButton =
  "h-9 shrink-0 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

const dangerButton =
  "h-9 shrink-0 rounded-lg border border-bad-fg/30 bg-bad-bg px-3 text-[13px] font-semibold text-bad-fg hover:bg-bad-bg/80 disabled:cursor-wait disabled:opacity-60";

export function CardDetailHeader({
  card,
  canRetire,
  busy,
  onBack,
  onRetire,
}: {
  card: CatalogCardListItem;
  canRetire: boolean;
  busy: boolean;
  onBack: () => void;
  onRetire: () => void;
}) {
  const pill = catalogStatusPill(card.status);
  const retired = card.status === "rejected";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={barButton} onClick={onBack}>
          ← Cards
        </button>
      </div>

      <header className="rounded-xl border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-[26px] leading-tight font-semibold">{card.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-body">
              <span>{card.issuer}</span>
              <StatusPill {...pill} />
              {card.network ? <span>{card.network}</span> : null}
              <span>Last verified {formatDate(card.last_verified)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {card.pending_change ? <StatusPill label="Pending change" tone="warn" /> : null}
              {!card.has_crawl_source ? (
                <StatusPill label="No crawl source yet" tone="neutral" />
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canRetire && !retired ? (
              <button type="button" className={dangerButton} disabled={busy} onClick={onRetire}>
                {busy ? "Retiring…" : "Retire card"}
              </button>
            ) : null}
            {retired ? <StatusPill label="Retired from API" tone="bad" /> : null}
            {!canRetire && !retired ? (
              <p className="text-[13px] text-body">Read-only: only admins can retire cards.</p>
            ) : null}
          </div>
        </div>
        {!card.has_crawl_source ? (
          <p role="note" className="mt-3 rounded-lg bg-neutral-bg px-4 py-2.5 text-sm text-neutral-fg">
            No crawl source yet for this issuer. Catalog values may be from seed data until a compare page is
            added under Sources.
          </p>
        ) : null}
      </header>
    </>
  );
}

function sourceCell(row: CatalogFieldRow) {
  if (row.source?.quote) {
    return (
      <p className="line-clamp-2 text-[13px] text-body italic">&ldquo;{row.source.quote}&rdquo;</p>
    );
  }
  if (row.source?.label) {
    return <p className="line-clamp-2 text-[13px] text-body">{row.source.label}</p>;
  }
  return <p className="text-[13px] text-muted">No quote yet</p>;
}

export function CardFieldsTable({ cardName, rows }: { cardName: string; rows: CatalogFieldRow[] }) {
  return (
    <section aria-labelledby="fields-heading" className="flex flex-col gap-3">
      <h2 id="fields-heading" className="font-display text-lg font-semibold">
        Fields
      </h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Catalog fields for {cardName}</caption>
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[38%]" />
            <col className="w-[40%]" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Field
              </th>
              <th scope="col" className="px-2 py-2.5 font-semibold">
                Value
              </th>
              <th scope="col" className="px-2 py-2.5 font-semibold">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="h-14 border-t border-line-soft align-middle">
                <th scope="row" className="px-4 py-2 text-left font-semibold">
                  <span className="line-clamp-2">{row.label}</span>
                </th>
                <td className="px-2 py-2">
                  <span className="line-clamp-2 text-sm font-medium">{row.value}</span>
                </td>
                <td className="px-2 py-2">{sourceCell(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CardHistoryTable({
  cardName,
  history,
  historyError,
}: {
  cardName: string;
  history: CardAuditEntry[];
  historyError: string | null;
}) {
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3">
      <h2 id="history-heading" className="font-display text-lg font-semibold">
        History
      </h2>
      {historyError ? (
        <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm text-bad-fg">
          {historyError}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">Audit history for {cardName}</caption>
          <thead>
            <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
              <th scope="col" className="px-4 py-2.5 font-semibold">
                When
              </th>
              <th scope="col" className="px-2 py-2.5 font-semibold">
                Action
              </th>
              <th scope="col" className="px-2 py-2.5 font-semibold">
                By
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id} className="border-t border-line-soft">
                <td className="px-4 py-3 whitespace-nowrap text-body">{formatDateTime(entry.at)}</td>
                <td className="px-2 py-3 font-medium">{auditActionLabel(entry.action)}</td>
                <td className="max-w-[240px] truncate px-2 py-3 text-body" title={entry.actor_email}>
                  {entry.actor_email}
                </td>
              </tr>
            ))}
            {history.length === 0 && !historyError ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-body">
                  No catalog changes recorded for this card yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
