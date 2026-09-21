import Image from "next/image";
import { IMAGES } from "@/lib/images";

const SCENES = [
  { image: IMAGES.groceries, label: "Groceries", span: "lg:col-span-2" },
  { image: IMAGES.dining, label: "Dining", span: "lg:col-span-1" },
  { image: IMAGES.travel, label: "Travel", span: "lg:col-span-1" },
  { image: IMAGES.cityDay, label: "Everyday spend", span: "lg:col-span-2" },
] as const;

export function LifestyleBand() {
  return (
    <section className="border-b border-border bg-muted/40 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-lg font-display text-2xl tracking-tight text-foreground sm:text-3xl">
          Built around how you actually spend.
        </h2>
        <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">
          Rank cards for the purchase in front of you, not a yearly average that
          ignores what you are buying right now.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {SCENES.map((scene) => (
            <figure key={scene.label} className={`min-w-0 ${scene.span}`}>
              <div className="relative aspect-[5/3] overflow-hidden rounded-xl bg-muted">
                <Image
                  src={scene.image.src}
                  alt={scene.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
                />
              </div>
              <figcaption className="mt-2.5 text-sm font-semibold text-foreground">
                {scene.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
