import Image from "next/image";
import { Button } from "@/components/ui/button";
import { IMAGES } from "@/lib/images";
import { APP_PATH } from "@/lib/routes";

/**
 * Hero v2: one full-bleed purchase photo, two compositions by breakpoint.
 * - Mobile: type over a teal scrim on the photo (image is the first-viewport plane)
 * - Desktop: hard left color slab over the photo (not a soft 50/50 SaaS card split)
 */
export function Hero() {
  return (
    <section className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden border-b border-border">
      <Image
        src={IMAGES.heroProduce.src}
        alt={IMAGES.heroProduce.alt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_40%]"
      />

      {/* Mobile scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[var(--result-top)] via-[var(--result-top)]/70 to-[var(--result-top)]/20 lg:hidden"
        aria-hidden
      />

      {/* Desktop brand slab + light multiply over the full photo */}
      <div
        className="absolute inset-y-0 left-0 hidden w-[min(42%,36rem)] bg-[var(--result-top)] lg:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[var(--result-top)]/10 mix-blend-multiply lg:block"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] w-full flex-col justify-end lg:justify-center">
        <div className="w-full px-4 pb-10 pt-16 text-white sm:px-6 sm:pb-12 lg:w-[min(42%,36rem)] lg:px-10 lg:pb-16 lg:pt-16 lg:text-[var(--result-top-fg)] xl:px-14">
          <div className="max-w-md">
            <p className="font-display text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              NorthTap
            </p>
            <h1 className="mt-5 max-w-[14ch] font-display text-2xl font-medium leading-[1.15] tracking-tight sm:text-3xl lg:text-[2.15rem]">
              Stop guessing at the terminal.
            </h1>
            <p className="mt-4 max-w-[32ch] text-base leading-relaxed text-white/85 sm:text-lg lg:text-[var(--result-top-fg)]/80">
              Rank the cards you carry by cents back for this purchase.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-[var(--result-top)] hover:bg-white/90 lg:bg-[var(--result-top-fg)] lg:text-[var(--result-top)] lg:hover:bg-[var(--result-top-fg)]/90"
              >
                <a href={APP_PATH}>Open the app</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/45 bg-transparent text-white hover:bg-white/10 hover:text-white lg:border-[var(--result-top-fg)]/40 lg:text-[var(--result-top-fg)] lg:hover:bg-white/10 lg:hover:text-[var(--result-top-fg)]"
              >
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
