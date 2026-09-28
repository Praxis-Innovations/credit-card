import { describe, expect, it } from "vitest";
import {
  checkCardShape,
  extractImageCandidates,
  hostAllowed,
  largestFromSrcset,
  rankCandidates,
  scoreCandidate,
  scoringPath,
  tokenize,
  type SelectContext,
} from "./select";

const PAGE = "https://www.td.com/ca/en/personal-banking/products/credit-cards/aeroplan/aeroplan-visa-infinite-card";

const ctx: SelectContext = {
  card: { id: "td-aeroplan-vi", issuer: "TD", name: "Aeroplan Visa Infinite" },
  siblingNames: [
    "Aeroplan Visa Infinite Privilege",
    "Aeroplan Visa",
    "Cash Back Visa Infinite",
    "First Class Travel Visa Infinite",
  ],
  allowedHosts: ["td.com"],
};

function page(body: string, head = ""): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe("extractImageCandidates", () => {
  it("collects og:image, img src / srcset, picture sources, preload, styles and inline JSON", () => {
    const html = page(
      `<img src="/content/dam/td/cards/a.png" alt="TD card">
       <img srcset="/s/small.png 320w, /s/large.png 1280w">
       <picture><source srcset="/p/card-800.webp 800w, /p/card-400.webp 400w"><img alt="pic"></picture>
       <div style="background-image:url('/bg/hero.jpg')"></div>
       <script>window.__DATA__ = {"art":"https:\\/\\/www.td.com\\/dam\\/json-card.png"}</script>
       <img src="data:image/png;base64,AAAA">`,
      `<meta property="og:image" content="https://www.td.com/og/share.jpg">
       <link rel="preload" as="image" href="/pre/card.png">`,
    );
    const urls = extractImageCandidates(html, PAGE).map((c) => `${c.origin} ${c.url}`);
    expect(urls).toEqual(
      expect.arrayContaining([
        "og:image https://www.td.com/og/share.jpg",
        "img https://www.td.com/content/dam/td/cards/a.png",
        "img https://www.td.com/s/large.png",
        "img https://www.td.com/p/card-800.webp",
        "preload https://www.td.com/pre/card.png",
        "style https://www.td.com/bg/hero.jpg",
        "inline https://www.td.com/dam/json-card.png",
      ]),
    );
    expect(urls.some((u) => u.includes("data:"))).toBe(false);
  });

  it("reads card art from data-* attributes, labelled by a sibling data-*name", () => {
    const html = page(
      `<div data-cardImg="/content/dam/tdct/browse-all/RewardsTravel_VISA_548x344.jpg"
            data-cardName="TD Rewards Visa* Card"></div>
       <div data-tracking="/not/an/image"></div>`,
    );
    const found = extractImageCandidates(html, PAGE);
    expect(found).toContainEqual({
      url: "https://www.td.com/content/dam/tdct/browse-all/RewardsTravel_VISA_548x344.jpg",
      origin: "img",
      alt: "TD Rewards Visa* Card",
    });
    expect(found.some((c) => c.url.includes("not/an/image"))).toBe(false);
  });

  it("picks the largest srcset entry", () => {
    expect(largestFromSrcset("/a.png 1x, /b.png 2x")).toBe("/b.png");
    expect(largestFromSrcset("/a.png 640w, /b.png 320w")).toBe("/a.png");
  });
});

describe("rankCandidates", () => {
  it("prefers the card's own art over award badges, banners, logos and hero photos", () => {
    const html = page(
      `<img src="/content/dam/td/images/awards/best-travel-card-award-badge-2026.png" alt="Award">
       <img src="/content/dam/td/images/banners/aeroplan-visa-infinite-banner.jpg">
       <img src="/content/dam/td/logos/td-logo.png" alt="TD">
       <img src="/content/dam/td/images/hero/aeroplan-hero-lifestyle.jpg">
       <img src="/content/dam/td/card-art/aeroplan-visa-infinite-card.png" alt="TD Aeroplan Visa Infinite Card">`,
      `<meta property="og:image" content="https://www.td.com/content/dam/td/social/og-default.jpg">`,
    );
    const { ranked, rejected } = rankCandidates(html, PAGE, ctx);
    expect(ranked[0]!.url).toBe(
      "https://www.td.com/content/dam/td/card-art/aeroplan-visa-infinite-card.png",
    );
    expect(ranked.map((c) => c.url).join(" ")).not.toMatch(/banner|hero|og-default/);
    expect(rejected.map((c) => c.rejected)).toEqual(
      expect.arrayContaining(["looks like a award", "looks like a logo"]),
    );
  });

  it("ranks this card above a sibling card shown on the same page", () => {
    const html = page(
      `<img src="/dam/card-art/aeroplan-visa-infinite-privilege-card.png">
       <img src="/dam/card-art/aeroplan-visa-infinite-card.png">`,
    );
    const { ranked } = rankCandidates(html, PAGE, ctx);
    expect(ranked[0]!.url).toContain("aeroplan-visa-infinite-card.png");
    expect(ranked.find((c) => c.url.includes("privilege"))?.score ?? 0).toBeLessThan(
      ranked[0]!.score,
    );
  });

  it("trusts alt text that names the card over a misleading file name", () => {
    const rewards: SelectContext = {
      ...ctx,
      card: { id: "td-rewards-visa", issuer: "TD", name: "Rewards Visa" },
      siblingNames: ["Rewards Visa Infinite", "First Class Travel Visa Infinite"],
    };
    const html = page(
      `<div data-cardImg="/dam/browse-all/FirstClassTravel_VISA_548x344.jpg"
            data-cardName="TD First Class Travel Visa Infinite* Card"></div>
       <div data-cardImg="/dam/browse-all/RewardsVisaInf_548x344.jpg"
            data-cardName="TD Rewards Visa Infinite* Card"></div>
       <div data-cardImg="/dam/browse-all/RewardsTravel_VISA_548x344.jpg"
            data-cardName="TD Rewards Visa* Card"></div>`,
    );
    const { ranked } = rankCandidates(html, PAGE, rewards);
    expect(ranked[0]).toMatchObject({
      url: "https://www.td.com/dam/browse-all/RewardsTravel_VISA_548x344.jpg",
      evidence: "strong",
    });
    expect(ranked[0]!.reasons).toContain("+40 alt names this card");
    for (const other of ranked.slice(1)) expect(other.score).toBeLessThan(ranked[0]!.score - 30);
  });

  it("does not treat a longer sibling name in the alt as naming this card", () => {
    const amex: SelectContext = {
      card: { id: "amex-gold", issuer: "American Express", name: "Gold Rewards Card" },
      siblingNames: ["Business Gold Rewards Card", "Platinum Card"],
      allowedHosts: ["americanexpress.com"],
    };
    const s = scoreCandidate(
      {
        url: "https://www.americanexpress.com/cards/Business_Gold_Rewards_Card.png",
        origin: "img",
        alt: "American Express Business Gold Rewards Card",
      },
      amex,
    );
    expect(s).toMatchObject({ evidence: "strong" });
    expect("reasons" in s && s.reasons.join("; ")).not.toMatch(/alt names this card/);
    expect("reasons" in s && s.reasons.join("; ")).toMatch(/other cards' tokens: business/);
  });

  it("breaks ties toward the plain rendition over student, US-dollar or French ones", () => {
    const cibc: SelectContext = {
      card: { id: "cibc-dividend", issuer: "CIBC", name: "Dividend Visa" },
      siblingNames: ["Dividend Visa Infinite"],
      allowedHosts: ["cibc.com"],
    };
    const html = page(
      `<img src="/content/dam/cards/cibc-dividend-visa-card-for-students-en.png" alt="CIBC Dividend Visa Card for Students">
       <img src="/content/dam/cards/cibc-dividend-visa-card-fr.png" alt="CIBC Dividend Visa Card">
       <img src="/content/dam/cards/cibc-dividend-visa-card-en.png" alt="CIBC Dividend Visa Card">`,
    );
    const { ranked } = rankCandidates(html, "https://www.cibc.com/en/dividend-visa-card.html", cibc);
    expect(ranked.map((c) => c.url.split("/").pop())).toEqual([
      "cibc-dividend-visa-card-en.png",
      "cibc-dividend-visa-card-fr.png",
      "cibc-dividend-visa-card-for-students-en.png",
    ]);
  });

  it("reads double-escaped markup in alt text as plain words", () => {
    const amex: SelectContext = {
      card: { id: "amex-aeroplan", issuer: "American Express", name: "Aeroplan" },
      siblingNames: ["Aeroplan Reserve", "Platinum Card"],
      allowedHosts: ["aexp-static.com"],
    };
    const html = page(
      `<img src="https://icm.aexp-static.com/cards/aeroplan-reserve-card.png"
            alt="American&amp;nbsp;Express&lt;sup&gt;®&lt;/sup&gt; Aeroplan&lt;sup&gt;®*&lt;/sup&gt; Reserve Card">`,
    );
    const [raw] = extractImageCandidates(html, PAGE);
    expect(raw!.alt).toBe("American Express ® Aeroplan ®* Reserve Card");
    const s = scoreCandidate(raw!, amex);
    expect("reasons" in s && s.reasons.join("; ")).not.toMatch(/alt names this card/);
  });

  it("still accepts an alt that names the card and mentions another card's word elsewhere", () => {
    const scotia: SelectContext = {
      card: { id: "scotia-gold-amex", issuer: "Scotiabank", name: "Gold American Express" },
      siblingNames: ["Platinum American Express", "Scene+ Visa"],
      allowedHosts: ["scotiabank.com"],
    };
    const s = scoreCandidate(
      {
        url: "https://www.scotiabank.com/x/_jcr_content/c/teaser.coreimg.png/1/amex-gold-card-en.png",
        origin: "img",
        alt: "Scotiabank Gold American Express Card with Scene rewards",
      },
      scotia,
    );
    expect("reasons" in s && s.reasons).toContain("+40 alt names this card");
  });

  it("falls back to og:image when there is no card-art path", () => {
    const html = page(
      `<img src="/dam/misc/people-at-airport.jpg">`,
      `<meta property="og:image" content="https://www.td.com/dam/aeroplan-visa-infinite.png">`,
    );
    const { ranked } = rankCandidates(html, PAGE, ctx);
    expect(ranked[0]).toMatchObject({
      origin: "og:image",
      url: "https://www.td.com/dam/aeroplan-visa-infinite.png",
    });
  });

  it("never offers images from non-issuer hosts, SVGs, or unrelated images", () => {
    const html = page(
      `<img src="https://cdn.comparison-site.example/cards/aeroplan-visa-infinite-card.png">
       <img src="/dam/card-art/aeroplan-visa-infinite-card.svg">
       <img src="/dam/misc/footer-decoration.png">`,
    );
    const { ranked, rejected } = rankCandidates(html, PAGE, ctx);
    expect(ranked).toEqual([]);
    expect(rejected.map((c) => c.rejected)).toEqual(
      expect.arrayContaining(["host is not an issuer domain", "vector / animated format"]),
    );
  });

  it("penalises comparison thumbnails, variant art and comparison-site award images", () => {
    const html = page(
      `<img src="/dam/images/aeroplan-infinite-visa-card-fr-comp39-en.jpeg">
       <img src="/dam/card-art/aeroplan-visa-infinite-platinum-card.png">
       <img src="/dam/misc/milesopedia-best-credit-card-2024.png">
       <img src="/dam/card-art/aeroplan-visa-infinite-card-front.png">`,
    );
    const { ranked, rejected } = rankCandidates(html, PAGE, ctx);
    expect(ranked[0]!.url).toContain("aeroplan-visa-infinite-card-front.png");
    for (const loser of ["comp39", "platinum"]) {
      const c = ranked.find((x) => x.url.includes(loser));
      expect(c?.score ?? 0, loser).toBeLessThan(ranked[0]!.score - 30);
    }
    expect(rejected.some((c) => c.url.includes("milesopedia"))).toBe(true);
  });

  it("scores a Next.js image-proxy URL by the proxied image path, on the issuer host", () => {
    const neo: SelectContext = {
      ...ctx,
      card: { id: "neo-world-elite", issuer: "Neo" as const, name: "World Elite Mastercard" },
      siblingNames: ["Mastercard"],
      allowedHosts: ["neofinancial.com"],
    };
    const inner = encodeURIComponent("https://blob.example/world-elite-card-desktop.webp");
    const html = page(`<img src="/_next/image?url=${inner}&w=1200&q=75">`);
    const { ranked } = rankCandidates(html, "https://www.neofinancial.com/credit-cards/neo-world-elite-mastercard", neo);
    expect(ranked[0]).toMatchObject({ evidence: "strong" });
    expect(ranked[0]!.url).toMatch(/^https:\/\/www\.neofinancial\.com\/_next\/image\?/);
  });

  it("marks candidates with only name or og:image evidence as weak", () => {
    const html = page(``, `<meta property="og:image" content="https://www.td.com/dam/aeroplan-infinite-750x510.jpeg">`);
    expect(rankCandidates(html, PAGE, ctx).ranked[0]).toMatchObject({ evidence: "weak" });
  });

  it("gives a reviewed hint the top spot", () => {
    const html = page(
      `<img src="/dam/card-art/aeroplan-visa-infinite-card.png">
       <img src="/dam/products/ACC-123-front.png">`,
    );
    const { ranked } = rankCandidates(html, PAGE, { ...ctx, hint: "acc-123-front" });
    expect(ranked[0]!.url).toContain("ACC-123-front");
  });

  describe("Adobe Experience Manager pages", () => {
    const scotia: SelectContext = {
      card: { id: "scotia-passport-vi", issuer: "Scotiabank", name: "Passport Visa Infinite" },
      siblingNames: ["Scene+ Visa", "Scene+ Visa Infinite", "Momentum Visa"],
      allowedHosts: ["scotiabank.com"],
    };
    const PAGE_PATH =
      "https://www.scotiabank.com/ca/en/personal/credit-cards/visa/passport-infinite-card/_jcr_content/root/container";

    it("scores a rendition by its asset file name, not the page path it is served under", () => {
      const html = page(
        `<img src="${PAGE_PATH}/carddeck/teaser.coreimg.png/1784321529851/sceneplusvisa-noname-en-2x.png"
              alt="Scotiabank Scene Plus Visa Credit Card">`,
      );
      const { ranked } = rankCandidates(html, PAGE, scotia);
      expect(ranked).toEqual([]);
      const s = scoreCandidate(
        {
          url: `${PAGE_PATH}/carddeck/teaser.coreimg.png/1784321529851/sceneplusvisa-noname-en-2x.png`,
          origin: "img",
          alt: "Scotiabank Scene Plus Visa Credit Card",
        },
        scotia,
      );
      expect("reasons" in s && s.reasons.join("; ")).toMatch(/other cards' tokens: scene/);
    });

    it("keeps one candidate per asset, preferring the original rendition", () => {
      const file = "1784321529851/passport-visa-infinite-card-en.png";
      const html = page(
        `<img src="${PAGE_PATH}/a/image.coreimg.80.456.png/${file}">
         <img src="${PAGE_PATH}/b/image.coreimg.png/${file}">
         <img src="${PAGE_PATH}/a/image.coreimg.80.991.png/${file}">`,
      );
      const { ranked } = rankCandidates(html, PAGE, scotia);
      expect(ranked.map((c) => c.url)).toEqual([`${PAGE_PATH}/b/image.coreimg.png/${file}`]);
    });

    it("scores a DAM rendition by the asset path", () => {
      expect(
        scoringPath(
          "https://www.cibc.com/content/dam/cards/cibc-aeroplan-visa-infinite-en.png/_jcr_content/renditions/cq5dam.web.1280.1280.png",
        ),
      ).toBe("/content/dam/cards/cibc-aeroplan-visa-infinite-en.png");
    });

    it("rejects unexpanded {.width} URL templates", () => {
      const html = page(`<img src="${PAGE_PATH}/a/image.coreimg%7B.width%7D.png/1/passport-card.png">`);
      expect(rankCandidates(html, PAGE, scotia).rejected[0]).toMatchObject({
        rejected: "URL template, not an image",
      });
    });
  });
});

describe("scoreCandidate", () => {
  it("explains its score", () => {
    const s = scoreCandidate(
      { url: "https://www.td.com/dam/card-art/aeroplan-visa-infinite.png", origin: "img" },
      ctx,
    );
    expect("reasons" in s && s.reasons.join("; ")).toMatch(/card-art path.*name tokens in path: aeroplan/);
  });
});

describe("tokenize", () => {
  it("splits camelCase file names and keeps '+' as its own word", () => {
    expect(tokenize("RewardsTravel_VISA_548x344.jpg")).toEqual(["rewards", "travel", "visa", "548x344", "jpg"]);
    expect(tokenize("Scene+ Visa®")).toEqual(["scene", "plus", "visa"]);
  });
});

describe("hostAllowed", () => {
  it("matches issuer domains and their subdomains only", () => {
    expect(hostAllowed("https://icm.aexp-static.com/x.png", ["aexp-static.com"])).toBe(true);
    expect(hostAllowed("https://www.td.com/x.png", ["td.com"])).toBe(true);
    expect(hostAllowed("https://eviltd.com/x.png", ["td.com"])).toBe(false);
    expect(hostAllowed("https://td.com.evil.example/x.png", ["td.com"])).toBe(false);
  });
});

describe("checkCardShape", () => {
  it("accepts ID-1 proportions and rejects banners, squares, portraits and thumbnails", () => {
    expect(checkCardShape({ width: 856, height: 540 }).ok).toBe(true);
    expect(checkCardShape({ width: 600, height: 380 }).ok).toBe(true);
    expect(checkCardShape({ width: 1200, height: 630 })).toMatchObject({ ok: false });
    expect(checkCardShape({ width: 1920, height: 600 })).toMatchObject({ ok: false });
    expect(checkCardShape({ width: 500, height: 500 })).toMatchObject({ ok: false });
    expect(checkCardShape({ width: 380, height: 600 })).toMatchObject({ ok: false });
    expect(checkCardShape({ width: 160, height: 101 })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/too small/),
    });
  });
});
