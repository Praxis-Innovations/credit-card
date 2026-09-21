import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HeroCardFan } from "@/components/hero-card-fan";
import { IMAGES } from "@/lib/images";
import { APP_PATH } from "@/lib/routes";

/**
 * Hero: full-bleed card photography + hard teal brand slab on desktop,
 * with a fanned card mockup so the product category is unmistakable.
 */
export function Hero() {
  return (
    <section className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden border-b border-border">
      <Image
        src={IMAGES.heroCards.src}
        alt={IMAGES.heroCards.alt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%]"
      />

      {/* Mobile scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[var(--result-top)] via-[var(--result-top)]/75 to-[var(--result-top)]/30 lg:hidden"
        aria-hidden
      />

      {/* Desktop brand slab */}
      <div
        className="absolute inset-y-0 left-0 hidden w-[min(44%,38rem)] bg-[var(--result-top)] lg:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[var(--result-top)]/15 mix-blend-multiply lg:block"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] w-full flex-col justify-end lg:flex-row lg:items-stretch lg:justify-between">
        <div className="w-full px-4 pb-6 pt-14 text-white sm:px-6 sm:pb-8 lg:flex lg:w-[min(44%,38rem)] lg:flex-col lg:justify-center lg:px-10 lg:pb-16 lg:pt-16 lg:text-[var(--result-top-fg)] xl:px-14">
          <div className="max-w-lg">
            <p className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              NorthTap
            </p>
            <h1 className="mt-4 max-w-[18ch] font-display text-2xl font-medium leading-[1.15] tracking-tight sm:text-3xl lg:text-[2.05rem]">
              Which credit card earns the most for this purchase?
            </h1>
            <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-white/90 sm:text-lg lg:text-[var(--result-top-fg)]/85">
              NorthTap tells you which card in your wallet to use for a specific
              purchase, instantly. No bank linking required for the guest flow.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
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
                <a href="#why">Why use it</a>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-4 pb-10 sm:px-6 lg:items-end lg:justify-end lg:px-10 lg:pb-14 xl:px-14">
          <HeroCardFan />
        </div>
      </div>
    </section>
  );
}
