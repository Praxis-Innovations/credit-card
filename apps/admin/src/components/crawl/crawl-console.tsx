"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelCrawlRequest,
  requestCrawl,
  retryCrawl,
  type ActionResult,
} from "@/app/(console)/crawl/actions";
import { panelPill, panelState, panelTitle, whenLabel } from "@/lib/crawl/present";
import { ALL_ACTIVE_SCOPE, GITHUB_ACTIONS_CRAWLER_URL, type CrawlRun } from "@/lib/crawl/types";
import { formatDateTime } from "@/lib/sources/present";
import { StatusPill } from "@/components/sources/status-pill";

const primaryButton =
  "h-11 rounded-[10px] bg-teal px-[18px] text-[15px] font-semibold text-white hover:bg-teal-hover disabled:cursor-wait disabled:opacity-60";
const secondaryButton =
  "h-10 rounded-lg border border-field bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:cursor-wait disabled:opacity-60";
const selectClass = "h-11 min-w-[220px] rounded-lg border border-field bg-surface px-2.5 text-sm text-ink";

export type CrawlScopeOption = { id: string; issuer_name: string };

function openActions() {
  window.open(GITHUB_ACTIONS_CRAWLER_URL, "_blank", "noopener,noreferrer");
}

export function CrawlConsole({
  sources,
  latest,
  canEdit,
  loadError,
}: {
  sources: CrawlScopeOption[];
  latest: CrawlRun | null;
  canEdit: boolean;
  loadError: string | null;
}) {
  const router = useRouter();
  const [scope, setScope] = useState(sources[0]?.id ?? ALL_ACTIVE_SCOPE);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const state = panelState(latest);
  const title = panelTitle(state);
  const pill = panelPill(state);
  const when = whenLabel(latest);
  const busy = pendingKey !== null;

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

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Crawl</h1>
        <p className="text-[15px] text-body">
          Queue a crawl for the GitHub Actions worker. Logs, counts and costs stay in Actions — this page only
          shows the latest run.
        </p>
      </div>

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

      <section
        aria-labelledby="crawl-now-heading"
        className="flex flex-col gap-3.5 rounded-xl border border-line bg-surface p-5"
      >
        <h2 id="crawl-now-heading" className="text-[17px] font-semibold">
          Crawl now
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="crawl-scope" className="text-[13px] text-body">
              Scope
            </label>
            <select
              id="crawl-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={!canEdit || busy || sources.length === 0}
              className={selectClass}
            >
              {sources.length === 0 ? (
                <option value="">No active issuers</option>
              ) : (
                <>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.issuer_name}
                    </option>
                  ))}
                  <option value={ALL_ACTIVE_SCOPE}>All active issuers</option>
                </>
              )}
            </select>
          </div>
          {canEdit ? (
            <button
              type="button"
              className={primaryButton}
              disabled={busy || sources.length === 0}
              onClick={() => run("request", () => requestCrawl(scope))}
            >
              {pendingKey === "request" ? "Queueing…" : "Crawl now"}
            </button>
          ) : (
            <p className="text-[13px] text-body">Read-only: only admins can queue crawls.</p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="latest-crawl-heading"
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="latest-crawl-heading" className="text-[17px] font-semibold">
              {title}
            </h2>
            <p className="text-[13px] text-body">Latest crawl only — no run history on this page.</p>
          </div>
          <StatusPill {...pill} />
        </div>

        {latest ? (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-body">Scope</dt>
              <dd className="font-medium">{latest.source_scope}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-body">When</dt>
              <dd className="font-medium">{formatDateTime(when)}</dd>
            </div>
            {latest.requested_by ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-body">Requested by</dt>
                <dd className="font-medium">{latest.requested_by}</dd>
              </div>
            ) : null}
            {latest.status === "failed" && latest.error ? (
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-body">Error</dt>
                <dd className="font-medium text-bad-fg">{latest.error}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-body">No crawls yet. Queue one above.</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && latest?.status === "requested" ? (
            <button
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={() => run("cancel", () => cancelCrawlRequest(latest.id))}
            >
              {pendingKey === "cancel" ? "Cancelling…" : "Cancel request"}
            </button>
          ) : null}

          {latest?.status === "done" ? (
            <button type="button" className={secondaryButton} onClick={() => router.push("/review")}>
              Open review queue
            </button>
          ) : null}

          {canEdit && (latest?.status === "done" || latest?.status === "failed") ? (
            <button
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={() => run("retry", () => retryCrawl(latest.id))}
            >
              {pendingKey === "retry" ? "Queueing…" : "Retry crawl"}
            </button>
          ) : null}

          <button type="button" className={secondaryButton} onClick={openActions}>
            GitHub Actions
            <span className="sr-only"> (opens in a new tab)</span>
          </button>
        </div>
      </section>
    </>
  );
}
