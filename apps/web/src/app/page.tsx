import { CategoryLinks } from "@/components/category-links";
import { FaqSection } from "@/components/faq-section";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HOME_DESCRIPTION, HOME_FAQS, HOME_TITLE } from "@/lib/home";
import {
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/json-ld";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd(),
          websiteJsonLd(),
          softwareApplicationJsonLd(HOME_DESCRIPTION),
          faqPageJsonLd(HOME_FAQS),
        ]}
      />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <CategoryLinks />
        <FaqSection faqs={HOME_FAQS} />
      </main>
      <SiteFooter />
    </>
  );
}
