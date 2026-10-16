import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardDetail } from "@/components/cards/card-detail";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import {
  loadCardHistory,
  loadCatalogCard,
  loadLatestApprovedExtraction,
} from "@/lib/cards/load";

export const metadata: Metadata = { title: "Card detail" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).trim();
  if (!id || id.length > 120) notFound();

  const { supabase, role } = await requireConsoleSession();
  const [{ card, error }, extracted, historyRes] = await Promise.all([
    loadCatalogCard(supabase, id),
    loadLatestApprovedExtraction(supabase, id),
    loadCardHistory(supabase, id),
  ]);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
        {error}
      </p>
    );
  }
  if (!card) notFound();

  return (
    <CardDetail
      card={card}
      extracted={extracted}
      history={historyRes.entries}
      historyError={historyRes.error}
      canRetire={hasRole(role, "admin")}
    />
  );
}
