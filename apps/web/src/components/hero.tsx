import Image from "next/image";
import { Button } from "@/components/ui/button";
import { IMAGES } from "@/lib/images";

export function Hero() {
  return (
    <section className="relative min-h-[min(100dvh,860px)] overflow-hidden border-b border-border">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="flex flex-col justify-center px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:pb-16 lg:pr-10 lg:pt-16">
          <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            NorthTap
          </p>
          <h1 className="mt-5 max-w-md font-display text-2xl font-medium leading-[1.15] tracking-tight text-foreground/90 sm:text-3xl md:text-[2.15rem]">
            Tap the right card, every time.
          </h1>
          <p className="mt-4 max-w-[36ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            The rewards coach for Canadians. Pick a purchase category and see
            which card in your wallet earns the most.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href="#optimizer">Try it free</a>
            </Button>
            <Button size="lg" variant="outline" disabled title="App coming soon">
              Get the app
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No login · no bank linking · session-only on the web
          </p>
        </div>

        <div className="relative min-h-[280px] sm:min-h-[360px] lg:min-h-full">
          <Image
            src={IMAGES.heroPay.src}
            alt={IMAGES.heroPay.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="object-cover object-[center_35%]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent lg:bg-gradient-to-l lg:from-transparent lg:via-transparent lg:to-background/30"
            aria-hidden
          />
        </div>
      </div>
      <p className="mx-auto max-w-6xl border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-6">
        Built for the moment before you tap: groceries, dining, gas, travel, and
        more.
      </p>
    </section>
  );
}
