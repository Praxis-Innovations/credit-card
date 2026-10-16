import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreCodeDetail } from "@/components/store-codes/store-code-detail";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { loadStoreCodeDetail } from "@/lib/store-codes/load";

export const metadata: Metadata = { title: "Store code detail" };

export default async function StoreCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).trim();
  if (!id || id.length > 120) notFound();

  const { supabase, role } = await requireConsoleSession();
  const { brand, evidence, pendingReview, cards, error } = await loadStoreCodeDetail(
    supabase,
    id,
  );

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
        {error}
      </p>
    );
  }
  if (!brand) notFound();

  return (
    <StoreCodeDetail
      brand={brand}
      evidence={evidence}
      pendingReview={pendingReview}
      cards={cards}
      canAddTestPurchase={hasRole(role, "admin")}
    />
  );
}
