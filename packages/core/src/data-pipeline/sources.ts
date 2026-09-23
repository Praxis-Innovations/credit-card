import type { CrawlSource } from "./types";

/**
 * Public, unauthenticated pages for the Big Six Canadian banks.
 * Card listing hubs + known merchant/loyalty partnership pages already
 * represented (or adjacent to) partnerships.ts.
 *
 * Do not add login-walled or account-only URLs.
 */
export const BIG_SIX_SOURCES: CrawlSource[] = [
  // ── Card listing pages ────────────────────────────────────────────
  {
    id: "rbc-cards",
    issuer: "RBC",
    kind: "card_listing",
    url: "https://www.rbcroyalbank.com/credit-cards/",
  },
  {
    id: "td-cards",
    issuer: "TD",
    kind: "card_listing",
    url: "https://www.td.com/ca/en/personal-banking/products/credit-cards",
  },
  {
    id: "scotia-cards",
    issuer: "Scotiabank",
    kind: "card_listing",
    url: "https://www.scotiabank.com/ca/en/personal/credit-cards.html",
  },
  {
    id: "bmo-cards",
    issuer: "BMO",
    kind: "card_listing",
    url: "https://www.bmo.com/en-ca/main/personal/credit-cards/",
    notes:
      "BMO's edge network has historically blocked or hung automated fetches from some networks; failures are recorded, not retried aggressively.",
  },
  {
    id: "cibc-cards",
    issuer: "CIBC",
    kind: "card_listing",
    url: "https://www.cibc.com/en/personal-banking/credit-cards.html",
  },
  {
    id: "nbc-cards",
    issuer: "National Bank",
    kind: "card_listing",
    url: "https://www.nbc.ca/en/personal/credit-cards.html",
  },

  // ── Partnership / loyalty pages (Big Six–linked) ──────────────────
  {
    id: "scotia-shell",
    issuer: "Scotiabank",
    kind: "partnership",
    brand: "Shell",
    url: "https://www.scotiabank.com/ca/en/personal/programs-services/shell.html",
  },
  {
    id: "shell-scotia-partner",
    issuer: "Scotiabank",
    kind: "partnership",
    brand: "Shell",
    url: "https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html",
  },
  {
    id: "cibc-journie",
    issuer: "CIBC",
    kind: "partnership",
    brand: "JOURNIE",
    url: "https://www.cibc.com/en/special-offers/journie-gas-rewards.html",
  },
  {
    id: "journie-cibc-partner",
    issuer: "CIBC",
    kind: "partnership",
    brand: "JOURNIE",
    url: "https://journie.ca/on-en/partners/cibc",
  },
  {
    id: "rbc-moi-faq",
    issuer: "RBC",
    kind: "loyalty_program",
    brand: "Moi",
    url: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
  },
  {
    id: "cibc-costco",
    issuer: "CIBC",
    kind: "partnership",
    brand: "Costco",
    url: "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html",
  },
  {
    id: "bmo-air-miles",
    issuer: "BMO",
    kind: "loyalty_program",
    brand: "AIR MILES",
    url: "https://www.bmo.com/en-ca/main/personal/credit-cards/air-miles-world-elite-mastercard/",
    notes: "May fail if BMO edge blocks the crawler; recorded as source_failure.",
  },
];

export const PIPELINE_VERSION = "0.1.0";

/** Delay between requests to the same host (ms). Conservative by design. */
export const PER_HOST_DELAY_MS = 2_500;

/** Global ceiling so a hung host (e.g. BMO) cannot stall the whole run. */
export const FETCH_TIMEOUT_MS = 20_000;

export const USER_AGENT =
  "NorthTapDataPipeline/0.1 (+https://github.com/Praxis-Innovations; research; weekly; public pages only)";
