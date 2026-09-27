const SOURCE_URL =
  "https://www.scotiabank.com/ca/en/personal/programs-services/shell.html";

/** Flat teal card over a pale card, with an example recommendation overlapping them. */
export function HeroCards({ className = "" }: { className?: string }) {
  return (
    <figure
      aria-label="Two credit cards with an example recommendation"
      className={`@container w-full max-w-[342px] md:max-w-[640px] ${className}`}
    >
      <div className="hero-art">
        <div className="hero-art__card hero-art__back" aria-hidden="true" />
        <div className="hero-art__card hero-art__front" aria-hidden="true">
          <div className="hero-art__chip" />
          <svg
            className="hero-art__contactless"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M8.5 7.5a6 6 0 0 1 0 9" />
            <path d="M12 5a9.5 9.5 0 0 1 0 14" />
            <path d="M15.5 2.5a13 13 0 0 1 0 19" />
          </svg>
          <div className="hero-art__number">•••• 4821</div>
          <div className="hero-art__circles">
            <span />
            <span />
          </div>
        </div>

        <div className="hero-art__rec flex flex-col gap-2 rounded-2xl border border-divider bg-surface px-[18px] py-4 text-left md:px-6 md:py-[22px]">
          <p className="sr-only">Example recommendation</p>
          <p className="text-xs text-muted md:text-[13px]">
            At Shell · $60 on gas
          </p>
          <p className="font-display text-base leading-[1.25] font-semibold text-foreground md:text-[19px]">
            Scotiabank Gold American Express
          </p>
          <p className="text-[13px] leading-[1.5] text-body md:text-[15px]">
            Instant 3¢/L off and 1 Scene+ point per litre.
          </p>
          <p className="mt-1 border-t border-surface-divider pt-3 text-xs text-muted">
            Verified Sep 22, 2026 ·{" "}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source: Scotiabank Shell offer (opens in a new tab)"
              className="text-accent underline hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Source
            </a>
          </p>
        </div>
      </div>
    </figure>
  );
}
