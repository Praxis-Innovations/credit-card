import type { ReactNode } from "react";

/**
 * One result row in a "Cards, best first" list (hero Try-it widget and the
 * category calculator). The winner gets the highlight and a "Tap this" pill.
 */
export function RankedCardRow({
  best,
  art,
  name,
  detail,
  amount,
  dataCard,
}: {
  best: boolean;
  art?: ReactNode;
  name: string;
  detail: ReactNode;
  amount: string;
  dataCard?: string;
}) {
  return (
    <li
      data-card={dataCard}
      className={`relative flex items-center gap-2.5 rounded-xl p-3 md:gap-3.5 md:px-4 md:py-3.5 ${
        best
          ? "border-2 border-highlight-border bg-highlight"
          : "border border-divider bg-surface"
      }`}
    >
      {best && (
        <span className="absolute -top-2.5 left-3.5 rounded-full bg-pill px-2 py-0.5 text-[11px] leading-4 font-bold tracking-[0.04em] text-pill-foreground uppercase">
          Tap this
        </span>
      )}
      {art}
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-sm leading-[1.3] font-semibold text-foreground md:text-[15px]">
          {name}
        </span>
        <span className="text-[13px] text-muted">{detail}</span>
      </div>
      <span
        className={`shrink-0 font-display text-xl font-semibold md:text-[22px] ${
          best ? "text-accent" : "text-foreground"
        }`}
      >
        {amount}
        <span className="sr-only"> back</span>
      </span>
    </li>
  );
}
