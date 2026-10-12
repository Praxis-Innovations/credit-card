"use client";

import { Fragment, useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { checkSourceRobots, setSourcePaused, type ActionResult } from "@/app/(console)/sources/actions";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { displayUrl, formatDate, SCHEDULE_LABELS, statusPill } from "@/lib/sources/present";
import type { SourceRow } from "@/lib/sources/types";
import { SourceForm } from "./source-form";
import { StatusPill } from "./status-pill";

type FormMode = { mode: "add" } | { mode: "edit"; id: string } | null;

const rowButton =
  "h-8 rounded-lg border border-field bg-surface px-3 text-[13px] text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";

const ROBOTS_TEXT = {
  allowed: "Allowed",
  disallowed: "Disallowed",
  unreachable: "Unreachable (treated as disallowed)",
} as const;

function cardCount(source: SourceRow): string {
  if (source.urls.length > 0) return String(source.urls.length);
  if (source.catalogCount > 0) return `${source.catalogCount} seeded`;
  return "0";
}

function ExternalLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="underline-offset-2 hover:underline">
      {children}
      <span className="sr-only">
        {label ? ` ${label}` : ""} (opens in a new tab)
      </span>
    </a>
  );
}

function SourceDetails({ source, robotsAction }: { source: SourceRow; robotsAction: ReactNode }) {
  const robots = source.robots_status
    ? `${ROBOTS_TEXT[source.robots_status]} · checked ${formatDate(source.robots_checked_at)}`
    : "Not checked yet";
  return (
    <div className="flex flex-col gap-4 bg-canvas px-4 py-4">
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-body">Compare page</dt>
          <dd className="truncate font-medium">
            {source.compare_url ? (
              <ExternalLink href={source.compare_url}>{displayUrl(source.compare_url)}</ExternalLink>
            ) : (
              "Not set"
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-body">Card page URL pattern</dt>
          <dd className="font-medium">{source.url_pattern ?? "Not set"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-body">Schedule</dt>
          <dd className="font-medium">{SCHEDULE_LABELS[source.schedule]}</dd>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <dt className="text-body">robots.txt</dt>
          <dd className="font-medium">{robots}</dd>
          {robotsAction ? <dd className="mt-1.5">{robotsAction}</dd> : null}
        </div>
        {source.notes ? (
          <div className="flex flex-col gap-0.5 sm:col-span-2 xl:col-span-4">
            <dt className="text-body">Notes</dt>
            <dd className="font-medium whitespace-pre-line">{source.notes}</dd>
          </div>
        ) : null}
      </dl>

      <div className="rounded-lg border border-line bg-surface">
        <div className="flex flex-col gap-0.5 border-b border-line px-4 py-3">
          <h3 className="text-[15px] font-semibold">{source.issuer_name} · card pages found</h3>
          <span className="text-[13px] text-body">
            {source.urls.length === 1 ? "1 card page" : `${source.urls.length} card pages`} on the compare page
          </span>
        </div>
        {source.urls.length === 0 ? (
          <p className="px-4 py-6 text-sm text-body">
            No card pages yet. Once the crawler runs, every card page it finds on {source.issuer_name}&apos;s compare
            page will be listed here.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] text-body uppercase">
                <th scope="col" className="px-4 py-2.5 font-semibold">Card found</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Catalog link</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">First seen</th>
                <th scope="col" className="px-2 py-2.5 font-semibold">Page</th>
                <th scope="col" className="px-4 py-2.5 pl-2 font-semibold">Crawl it</th>
              </tr>
            </thead>
            <tbody>
              {source.urls.map((u) => (
                <tr key={u.id} className="border-t border-line-soft">
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold">{u.card_name}</th>
                  <td className="px-2 py-2.5 text-[13px] font-semibold">
                    {u.linked_card_id ? (
                      <span className="text-ok-fg">Linked: {u.linked_card_id}</span>
                    ) : (
                      <span className="text-warn-fg">New: not linked yet</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-body">{formatDate(u.first_seen_at)}</td>
                  <td className="px-2 py-2.5">
                    <ExternalLink href={u.product_url} label={`for ${u.card_name}`}>
                      Product page
                    </ExternalLink>
                  </td>
                  <td className="px-4 py-2.5 pl-2 text-[13px]">{u.included ? "Included" : "Excluded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function SourcesConsole({
  sources,
  canEdit,
  loadError,
}: {
  sources: SourceRow[];
  canEdit: boolean;
  loadError: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [form, setForm] = useState<FormMode>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editing = form?.mode === "edit" ? (sources.find((s) => s.id === form.id) ?? null) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="font-display text-[30px] leading-tight font-semibold">Sources</h1>
          <p className="text-[15px] text-body">
            The scrape list. Each issuer&apos;s official compare page, and every card page found on it. Public pages
            only; robots.txt is always respected.
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

      <section aria-labelledby="issuers-heading" className="rounded-xl border border-line bg-surface">
        <h2 id="issuers-heading" className="sr-only">
          Issuers
        </h2>
        <div className="relative overflow-x-auto" role="region" aria-label="Issuer table" tabIndex={0}>
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.04em] whitespace-nowrap text-body uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Issuer</th>
                <th scope="col" className="px-2 py-3 font-semibold">Compare page</th>
                <th scope="col" className="px-2 py-3 font-semibold">Status</th>
                <th scope="col" className="px-2 py-3 font-semibold">Last crawl</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Cards</th>
                <th scope="col" className="px-4 py-3 pl-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const open = expanded.has(s.id);
                const detailsId = `source-${s.id}-details`;
                const pill = statusPill(s);
                const busy = pendingKey?.startsWith(`${s.id}:`) ?? false;
                return (
                  <Fragment key={s.id}>
                    <tr className="border-t border-line-soft">
                      <th scope="row" className="px-4 py-3 text-left">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={detailsId}
                          onClick={() => toggle(s.id)}
                          className="flex min-h-8 items-center gap-2 rounded text-sm font-semibold text-ink"
                        >
                          <span aria-hidden="true" className="w-3.5 text-body">
                            {open ? "▾" : "▸"}
                          </span>
                          {s.issuer_name}
                        </button>
                      </th>
                      <td className="max-w-[280px] truncate px-2 py-3 text-body">
                        {s.compare_url ? (
                          <ExternalLink href={s.compare_url} label={`${s.issuer_name} compare page`}>
                            {displayUrl(s.compare_url)}
                          </ExternalLink>
                        ) : (
                          <span className="text-muted">Not set</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <StatusPill {...pill} />
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-body">{formatDate(s.last_crawled_at)}</td>
                      <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">{cardCount(s)}</td>
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
                          <ComingSoonButton tooltip="Coming soon: the crawler isn't built yet">
                            Crawl now<span className="sr-only"> {s.issuer_name}</span>
                          </ComingSoonButton>
                        </div>
                      </td>
                    </tr>
                    <tr id={detailsId} hidden={!open}>
                      <td colSpan={6} className="border-t border-line-soft p-0">
                        {open ? (
                          <SourceDetails
                            source={s}
                            robotsAction={
                              canEdit && s.compare_url ? (
                                <button
                                  type="button"
                                  className={rowButton}
                                  disabled={busy}
                                  onClick={() => run(`${s.id}:robots`, () => checkSourceRobots(s.id))}
                                >
                                  {pendingKey === `${s.id}:robots` ? "Checking…" : "Check robots.txt"}
                                  <span className="sr-only"> for {s.issuer_name}</span>
                                </button>
                              ) : null
                            }
                          />
                        ) : null}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {sources.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-body">
                    No issuers yet. Add one to start the scrape list.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[13px] text-muted">
        The crawler never fetches a page robots.txt disallows, and never retries a blocked site with proxies.
      </p>
    </>
  );
}
