"use client";

import { useState } from "react";
import { addTestPurchaseFinding } from "@/app/(console)/store-codes/actions";
import type { Notice } from "@/components/action-feedback";
import type { CardOption } from "@/lib/store-codes/types";

const field =
  "h-11 w-full rounded-lg border border-field bg-surface px-3 text-sm text-ink";
const labelCls = "flex flex-col gap-1 text-[13px] font-semibold text-ink";
const primaryBtn =
  "h-11 rounded-[10px] bg-teal px-[18px] text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "h-11 rounded-lg border border-field bg-surface px-3.5 text-sm font-medium text-ink hover:bg-teal-soft";

export function AddTestPurchaseForm({
  brandId,
  brandName,
  cards,
  busy,
  onBusy,
  onNotice,
  onCancel,
  onSaved,
}: {
  brandId: string;
  brandName: string;
  cards: CardOption[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onNotice: (notice: Notice) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [mccShown, setMccShown] = useState("");
  const [categoryShown, setCategoryShown] = useState("");
  const [screenshotName, setScreenshotName] = useState("");

  async function onSubmit() {
    onBusy(true);
    try {
      const res = await addTestPurchaseFinding({
        brandId,
        brandName,
        cardId,
        date,
        statementText: statement,
        mccShown,
        categoryShown,
        screenshotFile: screenshotName,
      });
      onNotice({ ok: res.ok, message: res.message });
      if (res.ok) onSaved();
    } catch {
      onNotice({ ok: false, message: "Something went wrong. Refresh and try again." });
    } finally {
      onBusy(false);
    }
  }

  return (
    <section
      aria-label="Add a test purchase"
      className="flex flex-col gap-3.5 rounded-[14px] border-2 border-teal bg-surface px-6 py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">Add a test purchase</h2>
        <span className="text-[13px] text-body">
          Copy what your banking app shows. It goes to the review queue; nothing changes until you approve
          it there.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-4">
        <label className={labelCls}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
            disabled={busy}
          />
        </label>
        <label className={labelCls}>
          Statement line, copied as shown
          <input
            type="text"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder={`${brandName.toUpperCase()} #3124 TORONTO ON`}
            className={`${field} font-mono`}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className={labelCls}>
          Card
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className={field}
            disabled={busy || cards.length === 0}
          >
            {cards.length === 0 ? <option value="">No cards in catalog</option> : null}
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.network ? ` (${c.network})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Code, if shown (TD shows it)
          <input
            type="text"
            inputMode="numeric"
            value={mccShown}
            onChange={(e) => setMccShown(e.target.value)}
            placeholder="e.g. 5411"
            className={field}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className={labelCls}>
          Category or points shown
          <input
            type="text"
            value={categoryShown}
            onChange={(e) => setCategoryShown(e.target.value)}
            placeholder='e.g. 3x grocery, or "Other"'
            className={field}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className={labelCls}>
          Statement screenshot
          <input
            type="file"
            accept="image/*,application/pdf"
            className="h-11 w-full rounded-lg border border-dashed border-field bg-surface px-2.5 py-2 text-sm"
            disabled={busy}
            onChange={(e) => setScreenshotName(e.target.files?.[0]?.name ?? "")}
          />
        </label>
      </div>

      <p className="m-0 text-[13px] text-muted">
        We read the chain, store number, city and format from the statement line, so no address is needed.
        Category or points are needed only when there&apos;s no code.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button type="button" className={primaryBtn} disabled={busy} onClick={onSubmit}>
          {busy ? "Adding…" : "Add to review queue"}
        </button>
        <button type="button" className={ghostBtn} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
