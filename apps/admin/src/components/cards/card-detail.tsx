"use client";

import { useRouter } from "next/navigation";
import { ActionNotice, usePendingAction } from "@/components/action-feedback";
import { retireCard } from "@/app/(console)/cards/actions";
import { buildCatalogFieldRows } from "@/lib/cards/present";
import type { CardAuditEntry, CatalogCardListItem } from "@/lib/cards/types";
import type { Extraction } from "@/lib/review/types";
import { CardDetailHeader, CardFieldsTable, CardHistoryTable } from "./card-detail-sections";

export function CardDetail({
  card,
  extracted,
  history,
  historyError,
  canRetire,
}: {
  card: CatalogCardListItem;
  extracted: Extraction | null;
  history: CardAuditEntry[];
  historyError: string | null;
  canRetire: boolean;
}) {
  const router = useRouter();
  const { notice, pendingKey, run } = usePendingAction();
  const rows = buildCatalogFieldRows(card, extracted);
  const busy = pendingKey === "retire";

  const onRetire = () => {
    if (
      !window.confirm(
        `Retire ${card.name}? It will leave the live API (status Rejected) and stay visible here.`,
      )
    ) {
      return;
    }
    run("retire", async () => {
      const res = await retireCard(card.id);
      if (res.ok) router.refresh();
      return res;
    });
  };

  return (
    <>
      <CardDetailHeader
        card={card}
        canRetire={canRetire}
        busy={busy}
        onBack={() => router.push("/cards")}
        onRetire={onRetire}
      />
      <ActionNotice notice={notice} />
      <CardFieldsTable cardName={card.name} rows={rows} />
      <CardHistoryTable cardName={card.name} history={history} historyError={historyError} />
    </>
  );
}
