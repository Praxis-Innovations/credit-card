"use client";

import { StatusPill } from "@/components/sources/status-pill";
import { formatDate } from "@/lib/sources/present";
import {
  appTellsUsersCopy,
  categoryLabel,
  cellSourceLabel,
  certaintyPill,
  codesByFormatAndNetwork,
  evidenceCountLabel,
  presentEvidenceList,
  sourceTypeLabel,
  wikidataFromNotes,
  type FormatNetworkCell,
} from "@/lib/store-codes/present";
import type { EvidenceRow, MerchantBrandRow } from "@/lib/store-codes/types";

const barButton =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-field bg-surface px-3.5 text-sm font-medium text-ink hover:bg-teal-soft";
const primaryBtn =
  "inline-flex h-11 items-center gap-1.5 rounded-[10px] bg-teal px-[18px] text-[15px] font-semibold text-white hover:opacity-90";

export function StoreCodeBackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={barButton} onClick={onBack}>
        ← Store codes
      </button>
    </div>
  );
}

export function StoreCodeHeader({
  brand,
  evidenceCount,
  pendingReview,
  canAdd,
  adding,
  onToggleAdd,
}: {
  brand: MerchantBrandRow;
  evidenceCount: number;
  pendingReview: boolean;
  canAdd: boolean;
  adding: boolean;
  onToggleAdd: () => void;
}) {
  const cert = certaintyPill(brand.certainty);
  const wiki = wikidataFromNotes(brand.notes);
  return (
    <section aria-label="Store chain" className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-5 px-6 py-5">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-ok-bg text-teal"
        >
          <StoreBagIcon />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill {...cert} />
            {pendingReview ? <StatusPill label="To review" tone="ok" /> : null}
            <span className="text-sm text-body">
              {categoryLabel(brand.category)} · {evidenceCountLabel(evidenceCount)}
            </span>
          </div>
          <h1 className="font-display text-[26px] leading-tight font-semibold">{brand.name}</h1>
          <p className="m-0 text-sm text-body">
            {wiki ? `Wikidata ${wiki} · ` : null}
            matched to map places by brand
            {brand.last_verified ? ` · last verified ${formatDate(brand.last_verified)}` : null}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {canAdd ? (
            <button type="button" className={primaryBtn} onClick={onToggleAdd} aria-expanded={adding}>
              {adding ? "Hide form" : "Add test purchase"}
            </button>
          ) : (
            <p className="text-[13px] text-body">Only admins can add test purchases.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function StoreBagIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 8h14l-1 12H6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WhatAppTellsUsers({
  brand,
  evidence,
}: {
  brand: MerchantBrandRow;
  evidence: EvidenceRow[];
}) {
  return (
    <section
      aria-label="What users see"
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-5 py-4"
    >
      <h2 className="text-base font-semibold">What the app tells users</h2>
      <p className="m-0 rounded-[10px] bg-canvas px-3.5 py-3 text-[15px] leading-relaxed">
        {appTellsUsersCopy(brand, evidence)}
      </p>
      <span className="text-[13px] text-body">
        Generated from the certainty and the code table below. Codes change only through evidence and
        review.
      </span>
    </section>
  );
}

function CellText({ cell }: { cell: FormatNetworkCell }) {
  if (!cell.mcc) return <span className="text-body">Unknown</span>;
  return (
    <span>
      {cell.mcc}{" "}
      <StatusPill label={cellSourceLabel(cell)} tone={cell.confirmed ? "ok" : "neutral"} />
    </span>
  );
}

export function CodesByFormatTable({ evidence }: { evidence: EvidenceRow[] }) {
  const rows = codesByFormatAndNetwork(evidence);
  return (
    <section
      aria-label="Codes by store and network"
      className="overflow-x-auto rounded-xl border border-line bg-surface"
    >
      <div className="px-5 pt-4 pb-1">
        <h2 className="text-base font-semibold">Codes by store format and network</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-body">No evidence yet for this chain.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Store format
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Mastercard
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Visa
              </th>
              <th scope="col" className="px-5 py-2.5 pl-2 font-semibold">
                Amex
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.format} className="h-14 border-t border-line-soft">
                <th scope="row" className="px-5 text-left font-semibold">
                  {row.format}
                </th>
                <td className="px-2">
                  <CellText cell={row.mastercard} />
                </td>
                <td className="px-2">
                  <CellText cell={row.visa} />
                </td>
                <td className="px-5 pl-2">
                  <CellText cell={row.amex} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="m-0 px-5 pt-2.5 pb-4 text-[13px] text-body">
        A cell is Confirmed with 2 agreeing sources, one from the last 3 years. Format comes from the
        store name and its map tag.
      </p>
    </section>
  );
}

export function EvidenceTable({ evidence }: { evidence: EvidenceRow[] }) {
  const rows = presentEvidenceList(evidence);
  return (
    <section aria-label="Evidence" className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="px-5 pt-4 pb-1">
        <h2 className="text-base font-semibold">Evidence ({evidence.length})</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-body">No cited sources yet.</p>
      ) : (
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
              <th scope="col" className="px-5 py-2.5 font-semibold">
                Source
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Applies to
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Code
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Observed
              </th>
              <th scope="col" className="px-5 py-2.5 pl-2 font-semibold">
                Quote
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <EvidenceRowView key={e.id} row={e} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function EvidenceRowView({
  row,
}: {
  row: ReturnType<typeof presentEvidenceList>[number];
}) {
  return (
    <tr
      className={`border-t border-line-soft align-middle ${row.conflict_note ? "bg-warn-bg/40" : ""}`}
    >
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{row.source_label}</span>
          {row.url ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-field text-ink hover:bg-teal-soft"
              aria-label="Open source"
              onClick={() => window.open(row.url!, "_blank", "noopener,noreferrer")}
            >
              <ExternalIcon />
            </button>
          ) : null}
        </div>
        <span className="text-xs text-body">{sourceTypeLabel(row.source_type)}</span>
      </td>
      <td className="px-2 py-3">{row.applies_label}</td>
      <td className="px-2 py-3 font-variant-numeric tabular-nums">
        {row.mcc ?? row.mcc_shown ?? "—"}
      </td>
      <td className="px-2 py-3 whitespace-nowrap">
        {row.observed_date ? formatDate(row.observed_date) : "—"}
      </td>
      <td className="px-5 py-3 pl-2 text-neutral-fg">
        {row.quote || row.statement_text ? (
          <span>&ldquo;{row.quote ?? row.statement_text}&rdquo;</span>
        ) : (
          "—"
        )}
        {row.conflict_note ? (
          <>
            <br />
            <span className="text-xs text-warn-fg">{row.conflict_note}</span>
          </>
        ) : null}
      </td>
    </tr>
  );
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
