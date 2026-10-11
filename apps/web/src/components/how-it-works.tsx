import { CONTAINER } from "@/lib/styles";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Add your cards",
    body: "Choose the cards you already carry. No bank linking.",
  },
  {
    title: "Open it when you pay",
    body: "NorthTap finds the store you're at, or you pick a category.",
  },
  {
    title: "Use the best card",
    body: "See which card earns the most, in dollars.",
  },
];

/**
 * Numbered steps: a vertical timeline on phones, three columns from md. The
 * connector runs down to the next numeral, or across to the next column.
 */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className={CONTAINER}>
      <div className="flex flex-col gap-7 border-t border-divider pt-12 pb-14 md:gap-10 md:pt-20 md:pb-24 lg:gap-12 lg:pt-24 lg:pb-28">
        <h2
          id="how-heading"
          className="font-display text-[26px] font-semibold tracking-[-0.01em] text-foreground md:text-[32px] lg:text-4xl"
        >
          How it works
        </h2>
        <ol className="flex flex-col md:grid md:grid-cols-3 md:gap-8 lg:gap-12">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0 md:flex md:flex-col md:gap-2.5 md:pb-0"
            >
              {index < STEPS.length - 1 && (
                <span
                  className="absolute top-11 -bottom-2 left-[17px] w-0.5 bg-step-line md:top-[19px] md:right-0 md:bottom-auto md:left-14 md:h-0.5 md:w-auto"
                  aria-hidden="true"
                />
              )}
              <span
                className="flex size-9 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground md:mb-2.5 md:size-10 md:text-[17px]"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1.5 pt-[5px] md:contents">
                <h3 className="font-display text-[19px] leading-[1.3] font-semibold text-foreground md:text-xl md:leading-[1.25] lg:text-[22px]">
                  {step.title}
                </h3>
                <p className="text-base leading-[1.55] text-body md:max-w-[320px] md:leading-[1.6] lg:text-[17px]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
