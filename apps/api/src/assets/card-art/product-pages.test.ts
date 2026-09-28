import { describe, expect, it } from "vitest";
import { CARDS, ISSUERS } from "@/domain";
import { ISSUER_HOSTS, PRODUCT_PAGES } from "./product-pages";
import { hostAllowed } from "./select";

describe("card product-page mapping", () => {
  it("has a reviewed entry (URL or null) for every catalog card, and nothing else", () => {
    expect(Object.keys(PRODUCT_PAGES).sort()).toEqual(CARDS.map((c) => c.id).sort());
  });

  it("lists issuer-owned hosts for every issuer", () => {
    for (const issuer of ISSUERS) expect(ISSUER_HOSTS[issuer]?.length).toBeGreaterThan(0);
  });

  it("only points at https pages on the card's own issuer domain", () => {
    for (const card of CARDS) {
      const page = PRODUCT_PAGES[card.id];
      if (!page) continue;
      expect(page.url, card.id).toMatch(/^https:\/\//);
      expect(hostAllowed(page.url, ISSUER_HOSTS[card.issuer]!), card.id).toBe(true);
    }
  });

  it("never lists comparison sites, search engines or generic CDNs as issuer hosts", () => {
    const hosts = Object.values(ISSUER_HOSTS).flat().join(" ");
    expect(hosts).not.toMatch(
      /google|bing|duckduckgo|ratehub|nerdwallet|milesopedia|creditcardgenius|greedyrates|cloudfront|akamai|vercel|imgix|cloudinary/,
    );
  });
});
