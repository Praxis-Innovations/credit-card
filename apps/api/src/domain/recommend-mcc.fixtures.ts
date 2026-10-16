import type { CreditCard, MerchantBrand } from "./schema";

export const pointValuations = { "Amex MR": 2, cashback: 1, "Scene+": 1 } as const;

export const cobaltShared: CreditCard = {
  id: "fixture-cobalt",
  issuer: "American Express",
  name: "Cobalt",
  annualFee: 155.4,
  pointCurrency: "Amex MR",
  network: "Amex",
  lastVerified: "2026-10-01",
  welcomeOffer: { summary: "Up to 30,000 MR first year" },
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 5,
      capMonthly: 2500,
      capGroup: "cobalt-5x",
      rateAfterCap: 1,
      mccs: ["5411"],
      mccSource: "terms",
    },
    {
      category: "dining",
      earnRate: 5,
      capMonthly: 2500,
      capGroup: "cobalt-5x",
      rateAfterCap: 1,
      mccs: ["5812", "5814"],
      mccSource: "terms",
    },
    { category: "other", earnRate: 1 },
  ],
};

export const goldNamed: CreditCard = {
  id: "fixture-gold-amex",
  issuer: "Scotiabank",
  name: "Gold American Express",
  annualFee: 120,
  pointCurrency: "Scene+",
  network: "Amex",
  lastVerified: "2026-10-01",
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 6,
      merchants: ["sobeys", "Sobeys"],
      mccSource: "terms",
      quote: "6 Scene+ at Sobeys",
    },
    { category: "groceries", earnRate: 1, mccs: ["5411"], mccSource: "network_default" },
    { category: "other", earnRate: 1 },
  ],
};

export const tangerineChosen: CreditCard = {
  id: "fixture-tangerine",
  issuer: "Tangerine",
  name: "Money-Back Mastercard",
  annualFee: 0,
  pointCurrency: "cashback",
  network: "Mastercard",
  lastVerified: "2026-10-01",
  rewardCategories: [
    { category: "groceries", earnRate: 2, userChosen: true },
    { category: "other", earnRate: 0.5 },
  ],
};

export const momentumTier: CreditCard = {
  id: "fixture-momentum",
  issuer: "Scotiabank",
  name: "Momentum Visa Infinite",
  annualFee: 120,
  pointCurrency: "cashback",
  network: "Visa",
  lastVerified: "2026-10-01",
  rewardCategories: [
    {
      category: "groceries",
      earnRate: 4,
      mccs: ["5411"],
      mccSource: "terms",
      tierThreshold: 25000,
      capMonthly: 500,
    },
    { category: "other", earnRate: 1 },
  ],
};

export const sobeys: MerchantBrand = {
  id: "sobeys",
  name: "Sobeys",
  category: "groceries",
  sourceUrl: "https://example.com/sobeys",
  lastVerified: "2026-10-01",
  mcc: "5411",
  certainty: "confirmed",
  acceptedNetworks: ["visa", "mastercard", "amex"],
};

export const costco: MerchantBrand = {
  id: "costco-ca",
  name: "Costco",
  category: "other",
  sourceUrl: "https://example.com/costco",
  lastVerified: "2026-10-01",
  mcc: "5300",
  certainty: "confirmed",
  acceptedNetworks: ["mastercard"],
};

export const walmart: MerchantBrand = {
  id: "walmart",
  name: "Walmart",
  category: "groceries",
  sourceUrl: "https://example.com/walmart",
  lastVerified: "2026-10-01",
  mcc: "5310",
  certainty: "varies_by_store",
  acceptedNetworks: ["visa", "mastercard"],
};

export const visaCash: CreditCard = {
  id: "fixture-visa",
  issuer: "TD",
  name: "TD Cash Back Visa",
  annualFee: 0,
  pointCurrency: "cashback",
  network: "Visa",
  lastVerified: "2026-10-01",
  rewardCategories: [
    { category: "other", earnRate: 1 },
    { category: "groceries", earnRate: 2, mccs: ["5411"], mccSource: "network_default" },
  ],
};
