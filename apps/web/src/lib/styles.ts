/**
 * Page container: 24px gutter on phones, 48px from tablets up, and a centred
 * 1200px content width so header, sections and footer share the same edges.
 */
export const CONTAINER = "mx-auto w-full max-w-[1296px] px-6 md:px-12";

/** Ruled content section below the hero, as in How it works. */
export const SECTION =
  "flex flex-col gap-7 border-t border-divider pt-12 pb-14 md:gap-10 md:pt-20 md:pb-24 lg:gap-12 lg:pt-24 lg:pb-28";

export const SECTION_HEADING =
  "font-display text-[26px] font-semibold tracking-[-0.01em] text-foreground md:text-[32px] lg:text-4xl";

export const TEXT_LINK =
  "font-medium text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
