"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importMccResearchCsv } from "@/app/(console)/review/import/actions";
import { ActionNotice } from "@/components/action-feedback";
import {
  IMPORT_KIND_LABELS,
  IMPORT_KINDS,
  type ImportKind,
  type ImportResult,
} from "@/lib/mcc-import/types";

const rowButton =
  "h-9 rounded-lg border border-field bg-surface px-3 text-[13px] font-medium text-ink hover:bg-teal-soft disabled:opacity-50";
const primaryButton =
  "h-10 rounded-lg bg-teal px-4 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50";

export function ImportConsole({ canImport }: { canImport: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>("store_codes");
  const [csvText, setCsvText] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCsvText(reader.result);
    };
    reader.readAsText(file);
  }

  function runImport() {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await importMccResearchCsv(kind, csvText);
        setNotice({ ok: res.ok, message: res.message });
        if (res.ok) {
          setLastResult(res.result);
          router.refresh();
        }
      } catch {
        setNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
      }
    });
  }

  return (
    <>
      <div className="flex max-w-3xl flex-col gap-1.5">
        <h1 className="font-display text-[30px] leading-tight font-semibold">Import research CSV</h1>
        <p className="text-[15px] text-body">
          Loads research into the review queue as findings only. Nothing goes live until a validator
          approves it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={rowButton} onClick={() => router.push("/review?tab=store-codes")}>
          ← Store codes queue
        </button>
      </div>

      <ActionNotice notice={notice} />

      {!canImport ? (
        <p role="status" className="rounded-lg bg-warn-bg px-4 py-2.5 text-sm text-warn-fg">
          Importing research needs the admin role.
        </p>
      ) : (
        <section className="flex max-w-3xl flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">CSV format</legend>
            <div className="flex flex-wrap gap-2">
              {IMPORT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  className={`${rowButton} aria-[pressed=true]:border-teal aria-[pressed=true]:bg-teal-soft aria-[pressed=true]:text-teal`}
                  onClick={() => setKind(k)}
                  disabled={pending}
                >
                  {IMPORT_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Upload file
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="text-[13px] font-normal"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Or paste CSV
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={12}
              disabled={pending}
              spellCheck={false}
              className="rounded-lg border border-field bg-canvas px-3 py-2 font-mono text-[12px] font-normal text-ink"
              placeholder="chain,wikidata_id,mcc,network,..."
            />
          </label>

          <button
            type="button"
            className={primaryButton}
            disabled={pending || csvText.trim() === ""}
            onClick={runImport}
          >
            {pending ? "Importing…" : "Import to review queue"}
          </button>
        </section>
      )}

      {lastResult && lastResult.rejected.length > 0 ? (
        <section className="max-w-3xl rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Rejected rows</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-body">
            {lastResult.rejected.slice(0, 50).map((r) => (
              <li key={`${r.row}-${r.reason}`}>
                Row {r.row}: {r.reason}
              </li>
            ))}
          </ul>
          {lastResult.rejected.length > 50 ? (
            <p className="mt-2 text-[13px] text-muted">
              Showing the first 50 of {lastResult.rejected.length} rejected rows.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
