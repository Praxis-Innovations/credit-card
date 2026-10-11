import type { ReactNode } from "react";
import { CONTAINER } from "@/lib/styles";

const STEPS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Add your cards",
    body: "Choose the cards you already carry. No bank linking.",
    icon: (
      <>
        <rect x="9" y="6" width="22" height="15" rx="3" />
        <rect
          x="5"
          y="13"
          width="22"
          height="15"
          rx="3"
          className="fill-background"
        />
        <path d="M5 18.5h22" />
      </>
    ),
  },
  {
    title: "Open it when you pay",
    body: "NorthTap finds the store you're at, or you pick a category.",
    icon: (
      <>
        <path d="M18 31s-9-7.8-9-14.8a9 9 0 0 1 18 0C27 23.2 18 31 18 31z" />
        <circle cx="18" cy="16" r="3.2" />
      </>
    ),
  },
  {
    title: "Use the best card",
    body: "See which card earns the most, in dollars.",
    icon: (
      <>
        <rect x="4" y="9" width="24" height="16" rx="3" />
        <path d="M4 14.5h24" />
        <circle cx="27" cy="25" r="6" className="fill-background" />
        <path d="M24.5 25l1.8 1.8 3.4-3.6" />
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className={CONTAINER}>
      <div className="flex flex-col gap-7 border-t border-divider pt-12 pb-14 min-[600px]:block min-[600px]:pt-14 md:py-20 lg:py-28">
        <h2
          id="how-heading"
          className="font-display text-[26px] font-semibold tracking-[-0.01em] text-foreground min-[600px]:sr-only"
        >
          How it works
        </h2>
        {/* Below 600px: numbered timeline. From 600px: icon blocks, then the 3-column grid from md. */}
        <ol className="flex flex-col min-[600px]:gap-9 md:grid md:grid-cols-3 md:gap-10 lg:gap-16">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0 min-[600px]:flex min-[600px]:flex-col min-[600px]:gap-2 min-[600px]:pb-0 md:gap-3"
            >
              {index < STEPS.length - 1 && (
                <span
                  className="absolute top-11 -bottom-2 left-[17px] w-0.5 bg-step-line min-[600px]:hidden"
                  aria-hidden="true"
                />
              )}
              <span
                className="flex size-9 items-center justify-center rounded-full bg-primary font-display text-base font-semibold text-primary-foreground min-[600px]:hidden"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden text-accent min-[600px]:block"
                aria-hidden="true"
              >
                {step.icon}
              </svg>
              <span
                className="hidden text-[13px] text-muted min-[600px]:block md:text-sm"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1.5 pt-[5px] min-[600px]:contents">
                <h3 className="font-display text-[19px] leading-[1.3] font-semibold text-foreground min-[600px]:text-xl min-[600px]:leading-[1.4] lg:text-[22px]">
                  {step.title}
                </h3>
                <p className="text-base leading-[1.55] text-body min-[600px]:leading-[1.6] md:text-[17px]">
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
