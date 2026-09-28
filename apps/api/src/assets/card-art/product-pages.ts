/**
 * Reviewed mapping: catalog card id → the card's official product page on the
 * issuer's own domain. Used only by `assets:fetch-card-art` (dev / test art,
 * owner decision 2026-09-27 in docs/data/ASSETS.md).
 *
 * Rules: issuer domains only — never comparison sites, search engines or
 * third-party image CDNs. `null` means no live official page (the card gets the
 * generated render). `hint` is a reviewed substring of the right image path
 * when the page shows several cards.
 */

export interface ProductPage {
  url: string;
  hint?: string;
  /**
   * Reviewed issuer-hosted art for pages that render it client-side (not in
   * the HTML). Tried after the page's own candidates; same host / shape checks.
   */
  artUrl?: string;
  notes?: string;
}

/**
 * Hosts each issuer serves pages and card art from (suffix match). Only
 * issuer-owned domains belong here.
 */
export const ISSUER_HOSTS: Record<string, string[]> = {
  "American Express": ["americanexpress.com", "aexp-static.com"],
  TD: ["td.com"],
  CIBC: ["cibc.com"],
  Scotiabank: ["scotiabank.com"],
  RBC: ["rbcroyalbank.com", "rbc.com"],
  BMO: ["bmo.com"],
  Rogers: ["rogersbank.com"],
  Tangerine: ["tangerine.ca"],
  // PC Financial serves card art from its parent Loblaw's asset host.
  "PC Financial": ["pcfinancial.ca", "assetful.loblaw.ca"],
  Simplii: ["simplii.com"],
  Neo: ["neofinancial.com"],
  "Canadian Tire": ["triangle.com", "ctfs.com", "canadiantire.ca"],
  "National Bank": ["nbc.ca"],
  Desjardins: ["desjardins.com"],
  HSBC: ["hsbc.ca"],
  MBNA: ["mbna.ca"],
};

const AMEX = "https://www.americanexpress.com/en-ca";
const AMEX_ART = "https://icm.aexp-static.com/Internet/internationalcardshop/en_ca/images/cards";
const TD = "https://www.td.com/ca/en/personal-banking/products/credit-cards";
const CIBC = "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards";
const SCOTIA = "https://www.scotiabank.com/ca/en/personal/credit-cards";
const RBC = "https://www.rbcroyalbank.com/credit-cards";
const BMO = "https://www.bmo.com/en-ca/main/personal/credit-cards";

export const PRODUCT_PAGES: Record<string, ProductPage | null> = {
  // ── American Express ──────────────────────────────────────────────
  "amex-cobalt": { url: `${AMEX}/credit-cards/cobalt-card/` },
  "amex-gold": {
    url: `${AMEX}/credit-cards/gold-rewards-card/`,
    artUrl: `${AMEX_ART}/Gold_Rewards_Card.png`,
    notes: "Page HTML only has a two-card layout image (gold + rose gold).",
  },
  "amex-aeroplan-reserve": { url: `${AMEX}/credit-cards/aeroplan-reserve/` },
  "amex-aeroplan": { url: `${AMEX}/charge-cards/aeroplan-card/` },
  "amex-simplycash": { url: `${AMEX}/credit-cards/simply-cash/` },
  "amex-simplycash-preferred": { url: `${AMEX}/credit-cards/simply-cash-preferred/` },
  "amex-green": {
    url: `${AMEX}/credit-cards/green-card/`,
    artUrl: `${AMEX_ART}/Green-Card-Art.png`,
    notes: "Page is client-rendered; no image URLs in the HTML.",
  },
  "amex-platinum": { url: `${AMEX}/charge-cards/the-platinum-card/` },
  "amex-marriott-bonvoy": { url: `${AMEX}/credit-cards/marriott-bonvoy-card/` },
  "amex-business-gold": { url: `${AMEX}/charge-cards/small-business-gold-card/` },

  // ── TD ────────────────────────────────────────────────────────────
  "td-aeroplan-vi": { url: `${TD}/aeroplan/aeroplan-visa-infinite-card` },
  "td-aeroplan-vip": { url: `${TD}/aeroplan/aeroplan-visa-infinite-privilege-card` },
  "td-aeroplan-visa": {
    url: `${TD}/aeroplan/aeroplan-visa-platinum-card`,
    notes: "Catalog 'Aeroplan Visa' = TD Aeroplan Visa Platinum.",
  },
  "td-cash-back-vi": { url: `${TD}/cash-back/cash-back-visa-infinite-card` },
  "td-cash-back-visa": { url: `${TD}/cash-back/cash-back-visa-card` },
  "td-rewards-visa": { url: `${TD}/travel-rewards/rewards-visa-card` },
  "td-first-class-travel": { url: `${TD}/travel-rewards/first-class-travel-visa-infinite-card` },
  "td-rewards-visa-infinite": null, // No such TD product today (not in td.com sitemap).

  // ── CIBC ──────────────────────────────────────────────────────────
  "cibc-aeroplan-vi": { url: `${CIBC}/aeroplan-visa-infinite-card.html` },
  "cibc-aeroplan-visa": { url: `${CIBC}/aeroplan-visa-card.html` },
  "cibc-aventura-vi": { url: `${CIBC}/aventura-visa-infinite-card.html` },
  "cibc-aventura-vip": { url: `${CIBC}/aventura-visa-infinite-privilege-card.html` },
  "cibc-aventura-gold": { url: `${CIBC}/aventura-gold-visa-card.html` },
  "cibc-dividend-vi": { url: `${CIBC}/dividend-visa-infinite-card.html` },
  "cibc-dividend": { url: `${CIBC}/dividend-visa-card.html` },
  "cibc-costco-mc": { url: `${CIBC}/costco-mastercard.html` },
  "cibc-dividend-vip": null, // No Dividend Visa Infinite Privilege on cibc.com (404, not in sitemap).

  // ── Scotiabank ────────────────────────────────────────────────────
  "scotia-gold-amex": { url: `${SCOTIA}/american-express/gold-card.html` },
  "scotia-platinum-amex": { url: `${SCOTIA}/american-express/platinum-card.html` },
  "scotia-passport-vi": { url: `${SCOTIA}/visa/passport-infinite-card.html` },
  "scotia-momentum-vi": { url: `${SCOTIA}/visa/momentum-infinite-card.html` },
  "scotia-momentum": {
    url: `${SCOTIA}/visa/momentum-cash-back-card.html`,
    notes: "Annual-fee Momentum Visa (not momentum-no-fee-card.html).",
  },
  "scotia-scene-visa": { url: `${SCOTIA}/visa/scene-card.html` },
  "scotia-scene-vi": null, // No Scene+ Visa Infinite product on scotiabank.com.

  // ── RBC ───────────────────────────────────────────────────────────
  "rbc-avion-vi": { url: `${RBC}/travel/rbc-avion-visa-infinite.html` },
  "rbc-avion-vip": { url: `${RBC}/travel/rbc-avion-visa-infinite-privilege.html` },
  "rbc-westjet-we": { url: `${RBC}/travel/westjet-rbc-world-elite-mastercard.html` },
  "rbc-cashback": { url: `${RBC}/cash-back/rbc-cashback-mastercard.html` },
  "rbc-cashback-preferred": { url: `${RBC}/cash-back/rbc-preferred-world-elite-mastercard.html` },
  "rbc-moi-visa": { url: `${RBC}/rewards/moi-rbc-visa.html` },
  "rbc-ion": { url: `${RBC}/rewards/rbc-ion-visa.html` },
  "rbc-iono": { url: `${RBC}/rewards/rbc-ion-plus-visa.html` },
  "rbc-avion-gold": null, // RBC sells no "Avion Gold Visa"; closest (Avion Visa Platinum) is a different card.

  // ── BMO (edge often resets automated requests; failures fall back) ─
  "bmo-eclipse-vi": { url: "https://www.bmo.com/main/personal/credit-cards/bmo-eclipse-visa-infinite/" },
  "bmo-ascend-we": { url: `${BMO}/bmo-ascend-world-elite-mastercard/` },
  "bmo-cashback": { url: `${BMO}/bmo-cashback-mastercard/` },
  "bmo-cashback-we": { url: `${BMO}/bmo-cashback-world-elite-mastercard/` },
  "bmo-preferred-rate": { url: `${BMO}/preferred-rate-mastercard/` },
  "bmo-air-miles-we": {
    url: `${BMO}/bmo-blue-rewards-world-elite-mastercard/`,
    notes: "AIR MILES World Elite was renamed BMO Blue Rewards World Elite (2026); old URL serves this page.",
  },
  "bmo-air-miles": {
    url: `${BMO}/bmo-blue-rewards-mastercard/`,
    notes: "AIR MILES Mastercard was renamed BMO Blue Rewards Mastercard (2026).",
  },

  // ── Other issuers ─────────────────────────────────────────────────
  "rogers-red-we": { url: "https://www.rogersbank.com/en/rogers_red_worldelite_mastercard_details/" },
  "tangerine-moneyback": {
    url: "https://www.tangerine.ca/en/personal/spend/credit-cards/money-back-credit-card",
  },
  "pc-financial-we": { url: "https://www.pcfinancial.ca/en/credit-cards/world-elite/" },
  "pc-financial-world": { url: "https://www.pcfinancial.ca/en/credit-cards/world-mastercard/" },
  "pc-financial": {
    url: "https://www.pcfinancial.ca/en/credit-cards/pc-silver-mastercard/",
    notes: "Base no-fee PC Mastercard page.",
  },
  "simplii-cashback": { url: "https://www.simplii.com/en/credit-cards/cash-back-visa.html" },
  "neo-mastercard": {
    url: "https://www.neofinancial.com/credit-cards/neo-mastercard",
    hint: "mastercard-card-desktop",
    notes: "Art is proxied through neofinancial.com/_next/image; the name has no distinctive words.",
  },
  "neo-world-elite": { url: "https://www.neofinancial.com/credit-cards/neo-world-elite-mastercard" },
  "triangle-we": {
    url: "https://triangle.canadiantire.ca/en/credit-cards/triangle-world-elite-mastercard.html",
  },
  "triangle-mastercard": {
    url: "https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html",
  },
  "nbc-world-elite": { url: "https://www.nbc.ca/personal/mastercard-credit-cards/world-elite.html" },
  "nbc-allure": {
    url: "https://www.nbc.ca/personal/mastercard-credit-cards/allure.html",
    notes: "Issuer calls it the Allure Mastercard; the catalog's 'World Elite' / $150 fee look wrong.",
  },
  "desjardins-odyssey-we": {
    url: "https://www.desjardins.com/en/credit-cards/odyssey-world-elite-mastercard.html",
  },
  "desjardins-odyssey-gold": {
    url: "https://www.desjardins.com/en/credit-cards/odyssey-gold-visa.html",
    notes: "Issuer sells it as a Visa; the catalog lists Mastercard.",
  },
  "desjardins-bonus": null, // No "Bonus Dollars Mastercard"; the no-fee BONUSDOLLARS card is a Visa.
  "hsbc-westjet-we": null, // hsbc.ca no longer resolves (RBC acquired HSBC Canada in 2024).
  "mbna-rewards-we": {
    url: "https://www.mbna.ca/en/credit-cards/rewards/mbna-rewards-world-elite-mastercard",
  },
  "mbna-smart-cash": {
    url: "https://www.mbna.ca/en/credit-cards/cash-back/smart-cash-mastercard",
    notes: "No-fee Smart Cash Platinum Plus; there is no Smart Cash World Elite.",
  },
};
