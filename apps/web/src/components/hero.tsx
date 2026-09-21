import Image from "next/image";
import { Button } from "@/components/ui/button";
import { IMAGES } from "@/lib/images";
import { APP_PATH } from "@/lib/routes";

export function Hero() {
  return (
    <section className="relative min-h-[min(100dvh,820px)] overflow-hidden border-b border-border">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="flex flex-col justify-center px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:pb-16 lg:pr-10 lg:pt-16">
          <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            NorthTap
          </p>
          <h1 className="mt-5 max-w-md font-display text-2xl font-medium leading-[1.15] tracking-tight text-foreground/90 sm:text-3xl md:text-[2.15rem]">
            Tap the right card, every time.
          </h1>
          <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            The Canadian rewards coach for purchase-specific picks. See which
            card in your wallet earns the most before you tap.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href={APP_PATH}>Open the app</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Built for groceries, dining, gas, travel, and everyday spend.
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
    </section>
  );
}
