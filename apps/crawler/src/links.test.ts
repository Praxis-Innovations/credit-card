import { describe, expect, it } from "vitest";
import { acceptDiscoveredLinks, heuristicCardLinks, labelFromLinkText, matchesUrlPattern } from "./links";
import type { PageLink } from "./types";

const BASE = "https://www.scotiabank.com/ca/en/personal/credit-cards";

const OFFERED: PageLink[] = [
  { url: `${BASE}/visa/passport-infinite-card.html`, text: "See if it's right for you for the Scotiabank Passport Visa Infinite credit card" },
  { url: `${BASE}/american-express/gold-card.html`, text: "Gold Amex / Apply now" },
  { url: `${BASE}/american-express/compare-american-express-credit-cards.html`, text: "Compare Amex cards" },
  { url: `${BASE}/visa/student-scotia-momentum-no-fee-visa.html`, text: "Momentum No-Fee for Students" },
  { url: `${BASE}/scene-points-rewards-calculator.html`, text: "Rewards calculator" },
  { url: `${BASE}/travel.html`, text: "Travel cards" },
  { url: `${BASE}/manage-your-credit-card/welcome-kits.html`, text: "Welcome kits" },
  { url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing.html", text: "Chequing" },
];

describe("matchesUrlPattern", () => {
  it("treats the pattern as a case-insensitive path fragment", () => {
    expect(matchesUrlPattern(`${BASE}/visa/x.html`, "/credit-cards/")).toBe(true);
    expect(matchesUrlPattern(`${BASE}/visa/x.html`, "/CREDIT-CARDS/visa/")).toBe(true);
    expect(matchesUrlPattern("https://www.scotiabank.com/ca/en/personal/mortgages.html", "/credit-cards/")).toBe(false);
  });

  it("passes everything when no pattern is set", () => {
    expect(matchesUrlPattern(`${BASE}/visa/x.html`, null)).toBe(true);
    expect(matchesUrlPattern(`${BASE}/visa/x.html`, "  ")).toBe(true);
  });
});

describe("acceptDiscoveredLinks", () => {
  it("keeps offered links, rejects made-up URLs and ones outside url_pattern, dedupes", () => {
    const { accepted, rejected } = acceptDiscoveredLinks(
      [
        { card_name: "Passport Visa Infinite", url: `${BASE}/visa/passport-infinite-card.html#rates` },
        { card_name: "Passport again", url: `${BASE}/visa/passport-infinite-card.html` },
        { card_name: "Invented card", url: `${BASE}/visa/invented-card.html` },
        { card_name: "Chequing", url: "https://www.scotiabank.com/ca/en/personal/bank-accounts/chequing.html" },
        { card_name: "  ", url: `${BASE}/american-express/gold-card.html` },
      ],
      OFFERED,
      "/credit-cards/",
    );
    expect(accepted).toEqual([
      { card_name: "Passport Visa Infinite", url: `${BASE}/visa/passport-infinite-card.html` },
      { card_name: `${BASE}/american-express/gold-card.html`, url: `${BASE}/american-express/gold-card.html` },
    ]);
    expect(rejected.map((r) => [r.card_name, r.reason])).toEqual([
      ["Invented card", "not a link on the compare page"],
      ["Chequing", "outside url_pattern"],
    ]);
  });
});

describe("heuristicCardLinks", () => {
  it("picks product pages under a network folder and skips hubs, tools and comparisons", () => {
    expect(heuristicCardLinks(OFFERED, "/credit-cards/")).toEqual([
      { card_name: "Scotiabank Passport Visa Infinite credit card", url: `${BASE}/visa/passport-infinite-card.html` },
      { card_name: "Gold Amex", url: `${BASE}/american-express/gold-card.html` },
      { card_name: "Momentum No-Fee for Students", url: `${BASE}/visa/student-scotia-momentum-no-fee-visa.html` },
    ]);
  });
});

describe("labelFromLinkText", () => {
  it("strips call-to-action boilerplate and prefers the shortest label", () => {
    expect(labelFromLinkText("Learn more about the Value Visa / Value Visa Card")).toBe("Value Visa");
    expect(labelFromLinkText("Apply now")).toBe("");
  });
});
