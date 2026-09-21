import { Button } from "@/components/ui/button";
import { APP_PATH } from "@/lib/routes";

export function FinalCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            Ready to pick smarter at the terminal?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Open the purchase-specific recommender, add your cards, and see which
            one to tap next.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <a href={APP_PATH}>Open the app</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
