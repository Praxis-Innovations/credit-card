import Image from "next/image";
import { IMAGES } from "@/lib/images";

export function ValueProps() {
  return (
    <section className="border-b border-border py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          <Image
            src={IMAGES.dining.src}
            alt={IMAGES.dining.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Made for Canadian wallets.
          </h2>
          <ul className="mt-8 space-y-6">
            <li>
              <h3 className="font-display text-lg text-foreground">
                Your cards, not ours
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Rankings use the cards you select. No bank linking required for
                the web app experience.
              </p>
            </li>
            <li>
              <h3 className="font-display text-lg text-foreground">
                Cents back, explained
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Earn rates times point values become a simple ¢/$ figure, with a
                short reason you can trust at a glance.
              </p>
            </li>
            <li>
              <h3 className="font-display text-lg text-foreground">
                Rules, not guesses
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A deterministic engine from a curated Canadian card catalog. Not
                ML, not opaque scores.
              </p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
