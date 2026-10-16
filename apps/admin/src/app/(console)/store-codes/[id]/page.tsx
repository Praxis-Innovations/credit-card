import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreCodeDetail } from "@/components/store-codes/store-code-detail";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { loadStoreCodeDetail } from "@/lib/store-codes/load";

export const metadata: Metadata = { title: "Store code detail" };

async function brandIdFromParams(params: Promise<{ id: string }>): Promise<string> {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw).trim();
  if (!id || id.length > 120) notFound();
  return id;
}

export default async function StoreCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const brandId = await brandIdFromParams(params);
  const session = await requireConsoleSession();
  const detail = await loadStoreCodeDetail(session.supabase, brandId);

  if (detail.error) {
    return (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
        {detail.error}
      </p>
    );
  }
  if (!detail.brand) notFound();

  return (
    <StoreCodeDetail
      brand={detail.brand}
      evidence={detail.evidence}
      pendingReview={detail.pendingReview}
      cards={detail.cards}
      canAddTestPurchase={hasRole(session.role, "admin")}
    />
  );
}
