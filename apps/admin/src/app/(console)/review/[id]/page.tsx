import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewCard } from "@/components/review/review-card";
import { requireConsoleSession } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/roles";
import { loadFindingInQueue } from "@/lib/review/queue";
import { isUuid } from "@/lib/sources/validation";

export const metadata: Metadata = { title: "Review card" };

export default async function ReviewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase, role } = await requireConsoleSession();
  const { data, error } = await loadFindingInQueue(supabase, id);
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-bad-bg px-4 py-2.5 text-sm font-medium text-bad-fg">
        Could not load this finding. Refresh to try again.
      </p>
    );
  }
  if (!data) notFound();

  return (
    <ReviewCard
      finding={data.finding}
      index={data.index}
      total={data.total}
      previousId={data.previousId}
      nextId={data.nextId}
      canReview={hasRole(role, "validator")}
    />
  );
}
