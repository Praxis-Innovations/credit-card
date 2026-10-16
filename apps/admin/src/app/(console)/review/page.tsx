import type { Metadata } from "next";
import { ReviewConsole } from "@/components/review/review-console";
import { StoreCodesConsole } from "@/components/review/store-codes-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { loadStoreCodeQueueWithBrands } from "@/lib/mcc-review/queue";
import { loadReviewQueue, REVIEW_PAGE_SIZE } from "@/lib/review/queue";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { supabase, role } = await requireConsoleSession();
  const storeTab = tab === "store-codes";

  const [cards, stores] = await Promise.all([
    loadReviewQueue(supabase),
    loadStoreCodeQueueWithBrands(supabase),
  ]);

  if (storeTab) {
    return (
      <StoreCodesConsole
        findings={stores.findings}
        brands={stores.brands}
        canReview={hasRole(role, "validator")}
        canImport={hasRole(role, "admin")}
        truncated={stores.truncated}
        loadError={stores.error}
        cardCount={cards.data?.length ?? 0}
      />
    );
  }

  return (
    <ReviewConsole
      findings={cards.data ?? []}
      canReview={hasRole(role, "validator")}
      truncated={(cards.data?.length ?? 0) >= REVIEW_PAGE_SIZE}
      loadError={cards.error ? "Could not load the review queue. Refresh to try again." : null}
      storeCount={stores.findings.length}
    />
  );
}
