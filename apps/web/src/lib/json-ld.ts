import { APP_PATH } from "@/lib/routes";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import type { Faq } from "@/lib/faq";

export type JsonLdObject = { "@context": "https://schema.org"; "@type": string } & Record<
  string,
  unknown
>;

const CONTEXT = "https://schema.org" as const;

export function organizationJsonLd(siteUrl: string = SITE_URL): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: SITE_NAME,
    url: absoluteUrl("/", siteUrl),
    logo: absoluteUrl("/brand/northtap-app-icon-512.png", siteUrl),
    areaServed: { "@type": "Country", name: "Canada" },
  };
}

export function websiteJsonLd(siteUrl: string = SITE_URL): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE_NAME,
    url: absoluteUrl("/", siteUrl),
    inLanguage: "en-CA",
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function softwareApplicationJsonLd(
  description: string,
  siteUrl: string = SITE_URL,
): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    description,
    url: APP_PATH,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    inLanguage: "en-CA",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
      eligibleRegion: { "@type": "Country", name: "Canada" },
    },
    countriesSupported: "CA",
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function faqPageJsonLd(faqs: readonly Faq[]): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
  siteUrl: string = SITE_URL,
): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, siteUrl),
    })),
  };
}

/** JSON for a <script type="application/ld+json">; `<` is escaped so text can't close the tag. */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
