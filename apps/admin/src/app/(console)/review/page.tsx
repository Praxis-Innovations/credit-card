import type { Metadata } from "next";
import { ReviewConsole } from "@/components/review/review-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { loadReviewQueue, REVIEW_PAGE_SIZE } from "@/lib/review/queue";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const { supabase, role } = await requireConsoleSession();

  const { data, error } = await loadReviewQueue(supabase);

  return (
    <ReviewConsole
      findings={data ?? []}
      canReview={hasRole(role, "validator")}
      truncated={(data?.length ?? 0) >= REVIEW_PAGE_SIZE}
      loadError={error ? "Could not load the review queue. Refresh to try again." : null}
    />
  );
}
