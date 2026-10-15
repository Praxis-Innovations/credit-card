import { OpenAppLink } from "@/components/open-app-link";
import { TryItWidget } from "@/components/try-it-widget";
import { HOME_H1 } from "@/lib/home";
import { CONTAINER } from "@/lib/styles";

/**
 * DOM order follows the stacked (mobile) layout, where the widget sits before
 * the CTA. From lg the grid lifts the widget into its own column; the empty
 * 1fr rows above and below the text centre it against the widget.
 */
export function Hero() {
  return (
    <section
      id="top"
      className={`${CONTAINER} min-h-hero flex flex-col justify-center`}
    >
      <div className="flex w-full max-w-[640px] flex-col gap-4 pt-8 pb-10 md:gap-5 md:pt-16 md:pb-20 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_min(480px,45%)] lg:grid-rows-[1fr_repeat(5,auto)_1fr] lg:gap-x-16 lg:gap-y-0 lg:pt-24 lg:pb-32 xl:gap-x-24">
        <p className="text-sm font-semibold text-accent md:text-[15px] lg:col-start-1 lg:row-start-2">
          For Canadian cardholders
        </p>
        <h1 className="font-display text-[38px] leading-[1.08] font-semibold tracking-[-0.02em] text-foreground md:text-5xl md:leading-[1.05] lg:col-start-1 lg:row-start-3 lg:mt-6 lg:text-[clamp(40px,4.45vw,64px)]">
          {HOME_H1}
        </h1>
        <p className="text-[17px] leading-[1.6] text-body md:text-lg lg:col-start-1 lg:row-start-4 lg:mt-6 lg:max-w-[520px] lg:text-xl">
          Not sure which credit card to use? The best card changes with what
          you buy. NorthTap tells you which one to tap, and how much you get
          back.
        </p>
        <TryItWidget className="mt-2 lg:col-start-2 lg:row-span-full lg:mt-0 lg:self-center" />
        <OpenAppLink
          size="lg"
          className="mt-2 lg:col-start-1 lg:row-start-5 lg:mt-8 lg:justify-self-start"
        >
          Try it with your cards
        </OpenAppLink>
        <p className="text-center text-sm text-muted lg:col-start-1 lg:row-start-6 lg:mt-6 lg:text-left">
          Free · no account needed · no bank linking
        </p>
      </div>
    </section>
  );
}
