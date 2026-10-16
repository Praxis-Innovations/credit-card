"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionNotice, type Notice } from "@/components/action-feedback";
import type { CardOption, EvidenceRow, MerchantBrandRow } from "@/lib/store-codes/types";
import { AddTestPurchaseForm } from "./add-test-purchase-form";
import {
  CodesByFormatTable,
  EvidenceTable,
  StoreCodeBackBar,
  StoreCodeHeader,
  WhatAppTellsUsers,
} from "./store-code-detail-sections";

export function StoreCodeDetail({
  brand,
  evidence,
  pendingReview,
  cards,
  canAddTestPurchase,
}: {
  brand: MerchantBrandRow;
  evidence: EvidenceRow[];
  pendingReview: boolean;
  cards: CardOption[];
  canAddTestPurchase: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  return (
    <>
      <StoreCodeBackBar onBack={() => router.push("/store-codes")} />
      <StoreCodeHeader
        brand={brand}
        evidenceCount={evidence.length}
        pendingReview={pendingReview}
        canAdd={canAddTestPurchase}
        adding={adding}
        onToggleAdd={() => setAdding((v) => !v)}
      />
      <ActionNotice notice={notice} />
      {adding && canAddTestPurchase ? (
        <AddTestPurchaseForm
          brandId={brand.id}
          brandName={brand.name}
          cards={cards}
          busy={busy}
          onBusy={setBusy}
          onNotice={setNotice}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}
      <WhatAppTellsUsers brand={brand} evidence={evidence} />
      <CodesByFormatTable evidence={evidence} />
      <EvidenceTable evidence={evidence} />
    </>
  );
}
