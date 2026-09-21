import { Hero } from "@/components/hero";
import { LifestyleBand } from "@/components/lifestyle-band";
import { Optimizer } from "@/components/optimizer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <LifestyleBand />
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <Optimizer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
