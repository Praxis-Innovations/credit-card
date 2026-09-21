import Image from "next/image";
import { IMAGES } from "@/lib/images";

export function ValueProps() {
  return (
    <section
      id="why"
      className="scroll-mt-24 border-b border-border bg-muted/35 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted lg:order-2">
            <Image
              src={IMAGES.walletCards.src}
              alt={IMAGES.walletCards.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-center"
            />
          </div>
          <div className="lg:order-1">
            <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              Why open NorthTap before you tap
            </h2>
            <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-muted-foreground">
              Three reasons the ranking is worth a glance at the terminal.
            </p>
            <ul className="mt-8 space-y-6">
              <li>
                <h3 className="font-display text-lg text-foreground">
                  Your cards, not ours
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Rankings use the cards you select. No bank linking required for
                  the guest web flow.
                </p>
              </li>
              <li>
                <h3 className="font-display text-lg text-foreground">
                  Cents back, explained
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Earn rates times point values become a simple ¢/$ figure, with
                  a short reason you can trust at a glance.
                </p>
              </li>
              <li>
                <h3 className="font-display text-lg text-foreground">
                  Rules, not guesses
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  A deterministic engine from a curated Canadian card catalog.
                  Not ML, not opaque scores.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
