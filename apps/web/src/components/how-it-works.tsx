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
    body: "See which card earns the most, and why.",
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
      <div className="border-t border-divider py-14 md:py-20 lg:py-28">
        <h2 id="how-heading" className="sr-only">
          How NorthTap works
        </h2>
        <ol className="flex flex-col gap-9 md:grid md:grid-cols-3 md:gap-10 lg:gap-16">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2 md:gap-3">
              <svg
                width="36"
                height="36"
                viewBox="0 0 36 36"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                aria-hidden="true"
              >
                {step.icon}
              </svg>
              <span
                className="text-[13px] text-muted md:text-sm"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl font-semibold text-foreground lg:text-[22px]">
                {step.title}
              </h3>
              <p className="text-base leading-[1.6] text-body md:text-[17px]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
