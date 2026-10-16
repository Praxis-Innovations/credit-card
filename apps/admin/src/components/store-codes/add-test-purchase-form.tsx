"use client";

import { useState } from "react";
import { addTestPurchaseFinding } from "@/app/(console)/store-codes/actions";
import type { Notice } from "@/components/action-feedback";
import type { CardOption } from "@/lib/store-codes/types";
import { PurchaseFields, type PurchaseFormState } from "./purchase-fields";

const primaryBtn =
  "h-11 rounded-[10px] bg-teal px-[18px] text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "h-11 rounded-lg border border-field bg-surface px-3.5 text-sm font-medium text-ink hover:bg-teal-soft";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [state, setState] = useState<PurchaseFormState>({
    date: todayIso(),
    statement: "",
    cardId: cards[0]?.id ?? "",
    mccShown: "",
    categoryShown: "",
  });

  async function onSubmit() {
    onBusy(true);
    try {
      const res = await addTestPurchaseFinding({
        brandId,
        brandName,
        cardId: state.cardId,
        date: state.date,
        statementText: state.statement,
        mccShown: state.mccShown,
        categoryShown: state.categoryShown,
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
      <FormIntro />
      <PurchaseFields
        brandName={brandName}
        cards={cards}
        busy={busy}
        state={state}
        onPatch={(partial) => setState((s) => ({ ...s, ...partial }))}
      />
      <p className="m-0 text-[13px] text-muted">
        We read the chain, store number, city and format from the statement line, so no address is needed.
        Category or points are needed only when there&apos;s no code.
      </p>
      <FormActions busy={busy} onSubmit={onSubmit} onCancel={onCancel} />
    </section>
  );
}

function FormIntro() {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[17px] font-semibold">Add a test purchase</h2>
      <span className="text-[13px] text-body">
        Copy what your banking app shows. It goes to the review queue; nothing changes until you approve it
        there.
      </span>
    </div>
  );
}

function FormActions({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <button type="button" className={primaryBtn} disabled={busy} onClick={onSubmit}>
        {busy ? "Adding…" : "Add to review queue"}
      </button>
      <button type="button" className={ghostBtn} disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
