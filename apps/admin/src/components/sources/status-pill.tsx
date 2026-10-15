import type { PillTone } from "@/lib/sources/present";

const TONES: Record<PillTone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
  bad: "bg-bad-bg text-bad-fg",
  warn: "bg-warn-bg text-warn-fg",
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}>
      {label}
    </span>
  );
}
