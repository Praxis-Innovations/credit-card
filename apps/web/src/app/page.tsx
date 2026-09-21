import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { LifestyleBand } from "@/components/lifestyle-band";
import { ProductDemo } from "@/components/product-demo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ValueProps } from "@/components/value-props";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ValueProps />
        <LifestyleBand />
        <HowItWorks />
        <ProductDemo />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
