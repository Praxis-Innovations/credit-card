import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-10 pt-12 sm:pb-14 sm:pt-16">
      <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-accent/25 blur-3xl dark:bg-accent/10" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
          NorthTap
        </p>
        <h1 className="mt-4 max-w-xl font-display text-2xl font-medium leading-snug tracking-tight text-foreground/90 sm:text-3xl md:text-4xl">
          Tap the right card, every time.
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          The rewards coach for Canadians. Try the free picker below — or get
          the app to save your wallet and tap smarter every day.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <a href="#optimizer">Try it free</a>
          </Button>
          <Button size="lg" variant="outline" disabled title="App coming soon">
            Get the app
          </Button>
          <p className="w-full text-sm text-muted-foreground sm:w-auto">
            No login · no bank linking · session-only on the web
          </p>
        </div>
      </div>
    </section>
  );
}
