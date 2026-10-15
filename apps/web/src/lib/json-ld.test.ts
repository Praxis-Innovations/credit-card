import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "./json-ld";
import type { JsonLdObject } from "./json-ld";

const SITE = "https://northtap.test";

function roundTrip(data: JsonLdObject): JsonLdObject {
  return JSON.parse(serializeJsonLd(data));
}

describe("JSON-LD builders", () => {
  it("Organization and WebSite are linked by @id", () => {
    const org = roundTrip(organizationJsonLd(SITE));
    const site = roundTrip(websiteJsonLd(SITE));
    expect(org).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "NorthTap",
      url: SITE,
      logo: `${SITE}/brand/northtap-app-icon-512.png`,
    });
    expect(site).toMatchObject({
      "@type": "WebSite",
      url: SITE,
      inLanguage: "en-CA",
      publisher: { "@id": org["@id"] },
    });
  });

  it("SoftwareApplication is free, in CAD, for Canada", () => {
    const app = roundTrip(softwareApplicationJsonLd("About NorthTap", SITE));
    expect(app).toMatchObject({
      "@type": "SoftwareApplication",
      name: "NorthTap",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: "https://northtap-app.vercel.app",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CAD",
        eligibleRegion: { "@type": "Country", name: "Canada" },
      },
    });
  });

  it("FAQPage has a Question with an Answer per FAQ", () => {
    const faq = roundTrip(
      faqPageJsonLd([
        { question: "Q1?", answer: "A1." },
        { question: "Q2?", answer: "A2." },
      ]),
    );
    expect(faq).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Q1?", acceptedAnswer: { "@type": "Answer", text: "A1." } },
        { "@type": "Question", name: "Q2?", acceptedAnswer: { "@type": "Answer", text: "A2." } },
      ],
    });
  });

  it("BreadcrumbList has 1-based positions and absolute URLs", () => {
    const crumbs = roundTrip(
      breadcrumbJsonLd(
        [
          { name: "Home", path: "/" },
          { name: "Gas", path: "/gas" },
        ],
        SITE,
      ),
    );
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Gas", item: `${SITE}/gas` },
    ]);
  });

  it("escapes '<' so text can't close the script tag", () => {
    const json = serializeJsonLd(faqPageJsonLd([{ question: "</script>", answer: "<b>" }]));
    expect(json).not.toContain("<");
    expect(JSON.parse(json).mainEntity[0].name).toBe("</script>");
  });
});
