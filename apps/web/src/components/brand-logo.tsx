const SIZES = {
  md: {
    gap: "gap-2.5",
    mark: "h-7 w-auto",
    wordmark: "text-xl lg:text-[22px]",
  },
  sm: {
    gap: "gap-2",
    mark: "h-5 w-auto",
    wordmark: "text-base md:text-[17px]",
  },
} as const;

/**
 * NorthTap mark + wordmark. The mark is decorative (the wordmark carries the
 * name); dark mode swaps to the reverse (white card) mark.
 *
 * Plain <img> on purpose: the marks are tiny static SVGs, and next/image would
 * ship its client component for no benefit.
 */
export function BrandLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/northtap-mark.svg"
        alt=""
        width={76}
        height={54}
        className={`${s.mark} dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/northtap-mark-reverse.svg"
        alt=""
        width={76}
        height={54}
        className={`${s.mark} hidden dark:block`}
      />
      <span
        className={`font-display font-semibold tracking-[-0.02em] ${s.wordmark}`}
      >
        <span className="text-foreground">North</span>
        <span className="text-wordmark-accent">Tap</span>
      </span>
    </span>
  );
}
