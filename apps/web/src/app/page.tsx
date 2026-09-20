import { Hero } from "@/components/hero";
import { Optimizer } from "@/components/optimizer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <Optimizer />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
