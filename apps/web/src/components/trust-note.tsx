import { CONTAINER } from "@/lib/styles";

export function TrustNote() {
  return (
    <section aria-label="How recommendations are sourced" className={CONTAINER}>
      <div className="flex flex-col items-center gap-3.5 border-t border-divider pt-14 pb-16 text-center md:gap-5 md:pt-20 md:pb-24 lg:pt-28 lg:pb-32">
        <p className="max-w-[720px] font-display text-[22px] leading-[1.4] font-medium text-foreground md:text-[28px] lg:text-[32px] lg:leading-[1.35]">
          Every recommendation shows its source and the date it was checked.
        </p>
        <p className="max-w-[560px] text-[15px] leading-[1.6] text-body md:text-[17px]">
          Location is used only when you open the app, and never stored.
        </p>
      </div>
    </section>
  );
}
