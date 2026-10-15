import type { Metadata } from "next";
import { ReviewConsole } from "@/components/review/review-console";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { FINDING_COLUMNS, type PendingFinding } from "@/lib/review/types";

export const metadata: Metadata = { title: "Review queue" };

const PAGE_SIZE = 200;

export default async function ReviewPage() {
  const { supabase, role } = await requireConsoleSession();

  const { data, error } = await supabase
    .from("card_findings")
    .select(FINDING_COLUMNS)
    .eq("review_status", "pending")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)
    .returns<PendingFinding[]>();

  return (
    <ReviewConsole
      findings={data ?? []}
      canReview={hasRole(role, "validator")}
      truncated={(data?.length ?? 0) >= PAGE_SIZE}
      loadError={error ? "Could not load the review queue. Refresh to try again." : null}
    />
  );
}
