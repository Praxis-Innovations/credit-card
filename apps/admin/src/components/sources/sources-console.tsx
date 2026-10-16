"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { setSourcePaused, type ActionResult } from "@/app/(console)/sources/actions";
import { displayUrl, formatDate, statusPill } from "@/lib/sources/present";
import {
  SOURCES_PAGE_SIZE,
  SOURCE_STATUS_FILTERS,
  type CrawlSource,
  type SourceStatusFilter,
} from "@/lib/sources/types";
import { SourceForm } from "./source-form";
import { StatusPill } from "./status-pill";

type FormMode = { mode: "add" } | { mode: "edit"; id: string } | null;

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

const filterSelect =
  "h-10 rounded-lg border border-field bg-surface px-2.5 text-sm text-ink";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function SourcesConsole({
  sources,
  canEdit,
  loadError,
}: {
  sources: CrawlSource[];
  canEdit: boolean;
  loadError: string | null;
}) {
  const [form, setForm] = useState<FormMode>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SourceStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();
  const triggerRef = useRef<HTMLElement | null>(null);

  const restoreFocus = () => {
    const el = triggerRef.current;
    requestAnimationFrame(() => el?.focus());
  };

  const openForm = (mode: Exclude<FormMode, null>, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setNotice(null);
    setForm(mode);
  };

  const closeForm = useCallback(() => {
    setForm(null);
    restoreFocus();
  }, []);

  const onSaved = useCallback(
    (message: string) => {
      setNotice({ ok: true, message });
      closeForm();
    },
    [closeForm],
  );

  const run = (key: string, action: () => Promise<ActionResult>) => {
    setPendingKey(key);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        setNotice({ ok: res.ok, message: res.message });
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      } finally {
        setPendingKey(null);
      }
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.issuer_name.toLowerCase().includes(q);
    });
  }, [sources, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / SOURCES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * SOURCES_PAGE_SIZE, safePage * SOURCES_PAGE_SIZE);

  const setFilter = (next: SourceStatusFilter) => {
    setStatusFilter(next);
    setPage(1);
  };

  const setSearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const editing = form?.mode === "edit" ? (sources.find((s) => s.id === form.id) ?? null) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="font-display text-[30px] leading-tight font-semibold">Sources</h1>
          <p className="text-[15px] text-body">
            The scrape list. Each issuer&apos;s official compare page. Public pages only; robots.txt is always
            respected.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={(e) => openForm({ mode: "add" }, e.currentTarget)}
            aria-expanded={form?.mode === "add"}
            className="h-11 rounded-[10px] bg-teal px-[18px] text-[15px] font-semibold text-white hover:bg-teal-hover"
          >
            Add issuer
          </button>
        ) : (
          <p className="text-[13px] text-body">Read-only: only admins can change sources.</p>
        )}
      </div>

      {canEdit && form ? (
        <SourceForm
          key={form.mode === "edit" ? form.id : "add"}
          source={editing}
          onSaved={onSaved}
          onCancel={closeForm}
        />
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className={
          notice
            ? `rounded-lg px-4 py-2.5 text-sm font-medium ${notice.ok ? "bg-ok-bg text-ok-fg" : "bg-bad-bg text-bad-fg"}`
            : "sr-only"
        }
      >
        {notice?.message ?? ""}
      </p>

      {loadError ? (
        <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor="sources-search" className="text-[13px] text-body">
            Search
          </label>
          <input
            id="sources-search"
            type="search"
            value={query}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Issuer name"
            className="h-10 rounded-lg border border-field bg-surface px-2.5 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sources-status" className="text-[13px] text-body">
            Status
          </label>
          <select
            id="sources-status"
            value={statusFilter}
            onChange={(e) => setFilter(e.target.value as SourceStatusFilter)}
            className={filterSelect}
          >
            {SOURCE_STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section aria-labelledby="issuers-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="issuers-heading" className="sr-only">
          Issuers
        </h2>
        <div className="relative overflow-x-auto" role="region" aria-label="Issuer table" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] whitespace-nowrap text-body uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Issuer
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Compare page
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Last crawl
                </th>
                <th scope="col" className="px-4 py-3 pl-2 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const pill = statusPill(s);
                const busy = pendingKey?.startsWith(`${s.id}:`) ?? false;
                return (
                  <tr key={s.id} className="border-t border-line-soft">
                    <th scope="row" className="px-4 py-3 text-left text-sm font-semibold">
                      {s.issuer_name}
                    </th>
                    <td className="max-w-[320px] px-2 py-3">
                      {s.compare_url ? (
                        <button
                          type="button"
                          className={`${rowButton} max-w-full truncate`}
                          title={s.compare_url}
                          onClick={() => openUrl(s.compare_url!)}
                        >
                          {displayUrl(s.compare_url)}
                          <span className="sr-only"> for {s.issuer_name} (opens in a new tab)</span>
                        </button>
                      ) : (
                        <span className="text-muted">Not set</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <StatusPill {...pill} />
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-body">{formatDate(s.last_crawled_at)}</td>
                    <td className="px-4 py-3 pl-2">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {canEdit ? (
                          <>
                            <button
                              type="button"
                              className={rowButton}
                              disabled={busy}
                              onClick={(e) => openForm({ mode: "edit", id: s.id }, e.currentTarget)}
                            >
                              {s.status === "not_set_up" ? "Set up" : "Edit"}
                              <span className="sr-only"> {s.issuer_name}</span>
                            </button>
                            {s.status === "active" || s.status === "blocked" ? (
                              <button
                                type="button"
                                className={rowButton}
                                disabled={busy}
                                onClick={() => run(`${s.id}:pause`, () => setSourcePaused(s.id, true))}
                              >
                                {pendingKey === `${s.id}:pause` ? "Pausing…" : "Pause"}
                                <span className="sr-only"> {s.issuer_name}</span>
                              </button>
                            ) : null}
                            {s.status === "paused" ? (
                              <button
                                type="button"
                                className={rowButton}
                                disabled={busy}
                                onClick={() => run(`${s.id}:resume`, () => setSourcePaused(s.id, false))}
                              >
                                {pendingKey === `${s.id}:resume` ? "Resuming…" : "Resume"}
                                <span className="sr-only"> {s.issuer_name}</span>
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-body">
                    {sources.length === 0
                      ? "No issuers yet. Add one to start the scrape list."
                      : "No issuers match this search."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filtered.length > SOURCES_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[13px] text-body">
              Showing {(safePage - 1) * SOURCES_PAGE_SIZE + 1}–
              {Math.min(safePage * SOURCES_PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={rowButton}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-[13px] text-muted">
        The crawler never fetches a page robots.txt disallows, and never retries a blocked site with proxies.
      </p>
    </>
  );
}
