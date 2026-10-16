"use client";

import { useRouter } from "next/navigation";

const tabButton =
  "h-9 rounded-lg px-3 text-[13px] font-semibold aria-[current=page]:bg-teal-soft aria-[current=page]:text-teal border border-transparent aria-[current=page]:border-line hover:bg-teal-soft/60";

export function ReviewTabs({
  active,
  cardCount,
  storeCount,
}: {
  active: "cards" | "store-codes";
  cardCount: number;
  storeCount: number;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Review queues">
      <button
        type="button"
        role="tab"
        aria-selected={active === "cards"}
        aria-current={active === "cards" ? "page" : undefined}
        className={tabButton}
        onClick={() => router.push("/review")}
      >
        Cards
        <span className="ml-2 tabular-nums text-muted">{cardCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "store-codes"}
        aria-current={active === "store-codes" ? "page" : undefined}
        className={tabButton}
        onClick={() => router.push("/review?tab=store-codes")}
      >
        Store codes
        <span className="ml-2 tabular-nums text-muted">{storeCount}</span>
      </button>
    </div>
  );
}
