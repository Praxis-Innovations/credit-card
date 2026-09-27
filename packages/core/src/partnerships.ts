import type {
  LoyaltyProgram,
  MerchantBrand,
  MerchantPartnership,
} from "./schema";

/**
 * Production Canadian merchant ↔ loyalty ↔ card partnerships for NorthTap.
 *
 * HARD RULE: verified, cited entries only. No placeholders or synthetic deals.
 * If a claim cannot be confirmed from a primary source, it is omitted.
 *
 * Model: brand(s) → optional loyalty program → affiliated / linked card(s) →
 * typed benefits, each partnership carrying sourceUrls + lastVerified.
 */

const VERIFIED = "2026-09-22";

// ── Brands ──────────────────────────────────────────────────────────

export const MERCHANT_BRANDS: MerchantBrand[] = [
  {
    id: "shell",
    name: "Shell",
    category: "gas",
    notes: "~1,400 participating stations across Canada (Scotiabank / Shell Go+)",
    sourceUrl:
      "https://scotiabank.investorroom.com/2026-05-26-Scotiabank-Offers-Clients-More-Ways-to-Earn-Through-Scene-with-Shell-Canada",
    lastVerified: VERIFIED,
  },
  {
    id: "pioneer",
    name: "Pioneer",
    category: "gas",
    operator: "Parkland",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "ultramar",
    name: "Ultramar",
    category: "gas",
    operator: "Parkland",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "fas-gas",
    name: "Fas Gas",
    category: "gas",
    operator: "Parkland",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "chevron-parkland",
    name: "Chevron (Parkland)",
    category: "gas",
    operator: "Parkland",
    notes: "Participating Parkland Chevron stations in JOURNIE; not all Chevron Canada sites",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "on-the-run",
    name: "On the Run",
    category: "gas",
    operator: "Parkland",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "canadian-tire-gas-plus",
    name: "Canadian Tire Gas+",
    category: "gas",
    operator: "Canadian Tire",
    sourceUrl: "https://gasplus.canadiantire.ca/en/triangle-rewards.html",
    lastVerified: VERIFIED,
  },
  {
    id: "petro-canada",
    name: "Petro-Canada",
    category: "gas",
    notes: "Triangle Rewards partner locations for CT Money on fuel",
    sourceUrl: "https://triangle.canadiantire.ca/en/partners.html",
    lastVerified: VERIFIED,
  },
  {
    id: "costco-gas",
    name: "Costco Gas",
    category: "gas",
    operator: "Costco",
    sourceUrl:
      "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html",
    lastVerified: VERIFIED,
  },
  {
    id: "costco-warehouse",
    name: "Costco Warehouse",
    category: "groceries",
    operator: "Costco",
    notes: "Warehouse purchases earn 1% on CIBC Costco Mastercard (not elevated gas rate)",
    sourceUrl:
      "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html",
    lastVerified: VERIFIED,
  },
  {
    id: "costco-ca",
    name: "Costco.ca",
    category: "other",
    operator: "Costco",
    sourceUrl:
      "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html",
    lastVerified: VERIFIED,
  },
  {
    id: "esso",
    name: "Esso",
    category: "gas",
    operator: "Imperial Oil",
    notes: "PC Optimum earn + redeem; ~2,000 stations historically cited by Loblaw/Imperial",
    sourceUrl: "https://www.esso.ca/en-ca/pc-optimum-faq",
    lastVerified: VERIFIED,
  },
  {
    id: "mobil",
    name: "Mobil",
    category: "gas",
    operator: "Imperial Oil",
    notes:
      "PC Optimum earn rates; co-located Loblaw sites may post accelerated rates — check station",
    sourceUrl: "https://www.esso.ca/en-ca/pc-optimum-faq",
    lastVerified: VERIFIED,
  },
  {
    id: "loblaws",
    name: "Loblaws",
    category: "groceries",
    operator: "Loblaw",
    sourceUrl: "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    lastVerified: VERIFIED,
  },
  {
    id: "no-frills",
    name: "No Frills",
    category: "groceries",
    operator: "Loblaw",
    sourceUrl: "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    lastVerified: VERIFIED,
  },
  {
    id: "real-canadian-superstore",
    name: "Real Canadian Superstore",
    category: "groceries",
    operator: "Loblaw",
    sourceUrl: "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    lastVerified: VERIFIED,
  },
  {
    id: "shoppers-drug-mart",
    name: "Shoppers Drug Mart",
    category: "drugstore",
    operator: "Loblaw",
    sourceUrl: "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    lastVerified: VERIFIED,
  },
  {
    id: "pharmaprix",
    name: "Pharmaprix",
    category: "drugstore",
    operator: "Loblaw",
    sourceUrl: "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    lastVerified: VERIFIED,
  },
  {
    id: "sobeys",
    name: "Sobeys",
    category: "groceries",
    operator: "Empire",
    sourceUrl: "https://www.sobeys.com/sceneplus",
    lastVerified: VERIFIED,
  },
  {
    id: "safeway",
    name: "Safeway",
    category: "groceries",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "foodland",
    name: "Foodland",
    category: "groceries",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "freshco",
    name: "FreshCo",
    category: "groceries",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "iga",
    name: "IGA (participating)",
    category: "groceries",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "thrifty-foods",
    name: "Thrifty Foods",
    category: "groceries",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "lawtons-drugs",
    name: "Lawtons Drugs",
    category: "drugstore",
    operator: "Empire",
    sourceUrl:
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
    lastVerified: VERIFIED,
  },
  {
    id: "metro",
    name: "Metro",
    category: "groceries",
    operator: "METRO Inc.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
    lastVerified: VERIFIED,
  },
  {
    id: "food-basics",
    name: "Food Basics",
    category: "groceries",
    operator: "METRO Inc.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
    lastVerified: VERIFIED,
  },
  {
    id: "super-c",
    name: "Super C",
    category: "groceries",
    operator: "METRO Inc.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
    lastVerified: VERIFIED,
  },
  {
    id: "jean-coutu",
    name: "Jean Coutu",
    category: "drugstore",
    operator: "METRO Inc.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
    lastVerified: VERIFIED,
  },
  {
    id: "brunet",
    name: "Brunet",
    category: "drugstore",
    operator: "METRO Inc.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
    lastVerified: VERIFIED,
  },
];

// ── Loyalty programs ────────────────────────────────────────────────

export const LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  {
    id: "scene-plus",
    name: "Scene+",
    pointCurrency: "Scene+",
    description:
      "Coalition loyalty (Scotiabank / Cineplex / Empire). At Shell, Scene+ replaced AIR MILES nationally as of May 26, 2026.",
    sourceUrl: "https://www.scotiabank.com/ca/en/personal/programs-services/shell.html",
    lastVerified: VERIFIED,
  },
  {
    id: "shell-go-plus",
    name: "Shell Go+",
    description:
      "Shell Canada account used to link eligible Scotiabank / Tangerine payment cards for instant pump discounts; Scene+ membership may auto-link for Scene+-earning cards.",
    sourceUrl:
      "https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html",
    lastVerified: VERIFIED,
  },
  {
    id: "journie",
    name: "JOURNIE Rewards",
    description:
      "Parkland loyalty at participating Pioneer, Ultramar, Fas Gas, Chevron, and On the Run stations.",
    sourceUrl: "https://journie.ca/pe-en/terms",
    lastVerified: VERIFIED,
  },
  {
    id: "triangle",
    name: "Triangle Rewards",
    pointCurrency: "Triangle",
    description:
      "Canadian Tire loyalty; CT Money on Gas+ and Petro-Canada fuel when membership / Triangle card is used.",
    sourceUrl: "https://gasplus.canadiantire.ca/en/triangle-rewards.html",
    lastVerified: VERIFIED,
  },
  {
    id: "pc-optimum",
    name: "PC Optimum",
    pointCurrency: "PC Optimum",
    description:
      "Loblaw loyalty. Gas partnership is with Esso and Mobil — not Shell.",
    sourceUrl: "https://www.esso.ca/en-ca/pc-optimum-faq",
    lastVerified: VERIFIED,
  },
  {
    id: "moi-rewards",
    name: "Moi Rewards",
    pointCurrency: "Moi",
    description:
      "METRO Inc. loyalty (Ontario / Quebec / NB banners) with RBC Avion Rewards linked-card extras and the moi RBC Visa co-brand.",
    sourceUrl: "https://www.avionrewards.com/partnerships/moi-rewards/",
    lastVerified: VERIFIED,
  },
];

/** Scotiabank / Tangerine cards in the catalog that earn Scene+ points. */
const SCENE_PLUS_CARD_IDS = [
  "scotia-gold-amex",
  "scotia-passport-vi",
  "scotia-scene-visa",
  "scotia-scene-vi",
  "scotia-platinum-amex",
] as const;

/** Eligible CIBC personal credit cards in the catalog (Simplii excluded by CIBC terms). */
const CIBC_JOURNIE_CARD_IDS = [
  "cibc-aeroplan-vi",
  "cibc-dividend-vi",
  "cibc-dividend",
  "cibc-aventura-vi",
  "cibc-aventura-gold",
  "cibc-costco-mc",
  "cibc-aeroplan-visa",
  "cibc-dividend-vip",
  "cibc-aventura-vip",
] as const;

const TRIANGLE_CARD_IDS = ["triangle-mastercard", "triangle-we"] as const;

const PC_MASTERCARD_IDS = [
  "pc-financial",
  "pc-financial-world",
  "pc-financial-we",
] as const;

/** Representative RBC catalog cards eligible for Moi linked loyalty (moi Visa excluded — maxed already). */
const RBC_MOI_LINK_CARD_IDS = [
  "rbc-avion-vi",
  "rbc-avion-vip",
  "rbc-avion-gold",
  "rbc-cashback",
  "rbc-cashback-preferred",
  "rbc-iono",
  "rbc-ion",
  "rbc-westjet-we",
] as const;

const EMPIRE_GROCERY_BRAND_IDS = [
  "sobeys",
  "safeway",
  "foodland",
  "freshco",
  "iga",
  "thrifty-foods",
] as const;

// ── Partnerships ────────────────────────────────────────────────────

export const MERCHANT_PARTNERSHIPS: MerchantPartnership[] = [
  // 1. Shell ↔ Scene+ / Shell Go+ ↔ Scotiabank Scene+ cards
  {
    id: "shell-scene-scotia-scene-cards",
    merchantBrandIds: ["shell"],
    loyaltyProgramId: "scene-plus",
    cardIds: [...SCENE_PLUS_CARD_IDS],
    affiliation: "linked",
    requirements:
      "Link eligible Scotiabank Scene+-earning credit card to Shell Go+ (Scene+ membership auto-links). Pay with the linked card at participating Shell stations.",
    benefits: [
      {
        kind: "cents_per_litre_instant",
        amount: 3,
        summary: "Instant 3¢/L off all fuel grades",
        appliesTo: "all_fuel",
        capLitresMonthly: 1000,
      },
      {
        kind: "cents_per_litre_instant",
        amount: 4,
        summary: "Additional instant 4¢/L off Shell V-Power (promotional)",
        appliesTo: "shell_vpower",
        capLitresMonthly: 1000,
        promotional: true,
        promotionalEnds: "2027-06-01",
      },
      {
        kind: "points_per_litre",
        amount: 1,
        summary: "1 Scene+ point per litre on all fuel as a Scene+ member",
        appliesTo: "all_fuel",
        pointCurrency: "Scene+",
      },
      {
        kind: "points_per_litre",
        amount: 1,
        summary:
          "Additional 1 Scene+ point per litre on V-Power as a Shell Go+ member (with linked Scene+ card)",
        appliesTo: "shell_vpower",
        pointCurrency: "Scene+",
      },
    ],
    stacksWithCardCategoryRewards: true,
    notes:
      "Up to 7¢/L instant (3+4 on V-Power) plus Scene+ points value (issuer cites up to ~3¢/L equivalent on V-Power when including card $ spend earn). National rollout May 26, 2026.",
    sourceUrls: [
      "https://www.scotiabank.com/ca/en/personal/programs-services/shell.html",
      "https://www.shell.ca/en_ca/drivers/loyalty-and-payment/partners/scotiabank.html",
    ],
    lastVerified: VERIFIED,
  },

  // Shell ↔ Shell Go+ ↔ Tangerine Money-Back / Scotia Momentum (instant 3¢ only)
  {
    id: "shell-go-tangerine-scotia-cashback",
    merchantBrandIds: ["shell"],
    loyaltyProgramId: "shell-go-plus",
    cardIds: [
      "tangerine-moneyback",
      "scotia-momentum-vi",
      "scotia-momentum",
    ],
    affiliation: "linked",
    requirements:
      "Link eligible Tangerine or Scotiabank (non-Scene+) credit card to Shell Go+. Scene+ membership can be linked separately in the Shell app for base 1 pt/L.",
    benefits: [
      {
        kind: "cents_per_litre_instant",
        amount: 3,
        summary: "Instant 3¢/L off all fuel grades",
        appliesTo: "all_fuel",
        capLitresMonthly: 1000,
      },
    ],
    stacksWithCardCategoryRewards: true,
    notes:
      "V-Power extra 4¢/L requires a Scene+-earning credit card. Cash-back cards still earn their own gas-category cash back.",
    sourceUrls: [
      "https://www.scotiabank.com/ca/en/personal/programs-services/shell.html",
      "https://www.tangerine.ca/en/about-us/press-releases/pr-2026-05-26",
    ],
    lastVerified: VERIFIED,
  },

  // 2. Parkland JOURNIE ↔ CIBC
  {
    id: "journie-cibc-gas-discount",
    merchantBrandIds: [
      "pioneer",
      "ultramar",
      "fas-gas",
      "chevron-parkland",
      "on-the-run",
    ],
    loyaltyProgramId: "journie",
    cardIds: [...CIBC_JOURNIE_CARD_IDS],
    affiliation: "linked",
    requirements:
      "Register for JOURNIE, link eligible CIBC personal debit/credit card via CIBC Online/Mobile Banking, identify JOURNIE at pump (phone / app / card), and pay with the linked CIBC card. Simplii cards are excluded.",
    benefits: [
      {
        kind: "cents_per_litre_instant",
        amount: 3,
        summary: "Instant 3¢/L off any grade when JOURNIE is presented and linked CIBC card pays",
        appliesTo: "all_fuel",
        capLitresPerFill: 100,
      },
    ],
    stacksWithCardCategoryRewards: true,
    notes:
      "JOURNIE also awards its own points toward an additional 7¢/L after 300 points (program benefit, not CIBC-specific). CIBC Dividend / other category cash back continues to apply.",
    sourceUrls: [
      "https://www.cibc.com/en/special-offers/journie-gas-rewards.html",
      "https://journie.ca/on-en/partners/cibc",
      "https://journie.ca/pe-en/terms",
    ],
    lastVerified: VERIFIED,
  },

  // 3. Gas+ / Petro-Canada ↔ Triangle ↔ Triangle cards
  {
    id: "triangle-gas-plus-petro-canada",
    merchantBrandIds: ["canadian-tire-gas-plus", "petro-canada"],
    loyaltyProgramId: "triangle",
    cardIds: [...TRIANGLE_CARD_IDS],
    affiliation: "affiliated",
    requirements:
      "Pay with a Triangle Mastercard / World Elite Mastercard (or present Triangle Rewards membership when paying cash/debit for the lower non-card rate).",
    benefits: [
      {
        kind: "cents_per_litre_rewards",
        amount: 5,
        summary: "5¢/L back in CT Money on non-premium fuel with a Triangle credit card",
        appliesTo: "regular_fuel",
        pointCurrency: "Triangle",
      },
      {
        kind: "cents_per_litre_rewards",
        amount: 7,
        summary: "7¢/L back in CT Money on premium fuel with a Triangle credit card",
        appliesTo: "premium_fuel",
        pointCurrency: "Triangle",
      },
      {
        kind: "cents_per_litre_rewards",
        amount: 3,
        summary:
          "Up to 3¢/L in CT Money for Triangle Rewards members paying cash/debit (non-cardholder baseline)",
        appliesTo: "all_fuel_cash_debit",
        pointCurrency: "Triangle",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "CT Money is calculated on whole litres. Petro-Canada is a published Triangle partner; rates can vary by location. Card gas-category % in the catalog is illustrative — pump CT Money/L is the partnership benefit.",
    sourceUrls: [
      "https://gasplus.canadiantire.ca/en/triangle-rewards.html",
      "https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html",
      "https://triangle.canadiantire.ca/en/partners.html",
    ],
    lastVerified: VERIFIED,
  },

  // 4. Costco Gas (+ Costco.ca / warehouse) ↔ CIBC Costco Mastercard (direct)
  {
    id: "costco-cibc-mastercard-direct",
    merchantBrandIds: ["costco-gas", "costco-ca", "costco-warehouse"],
    loyaltyProgramId: null,
    cardIds: ["cibc-costco-mc"],
    affiliation: "direct",
    requirements:
      "Pay with CIBC Costco Mastercard (Costco membership required to hold the card). No separate loyalty program layer.",
    benefits: [
      {
        kind: "cashback_percent",
        amount: 3,
        summary: "3% cash back at Costco gas stations in Canada",
        appliesTo: "costco_gas",
        capAnnualSpendCad: 5000,
      },
      {
        kind: "cashback_percent",
        amount: 2,
        summary:
          "2% cash back at non-Costco gas and EV charging (MCC 5552) on the first $5,000 net annual gas/EV spend",
        appliesTo: "other_gas_and_ev",
        capAnnualSpendCad: 5000,
      },
      {
        kind: "cashback_percent",
        amount: 2,
        summary: "2% cash back at Costco.ca on the first $8,000 net annual Costco.ca spend",
        appliesTo: "costco_ca",
        capAnnualSpendCad: 8000,
      },
      {
        kind: "cashback_percent",
        amount: 1,
        summary: "1% cash back on other purchases including Costco warehouse",
        appliesTo: "costco_warehouse_and_other",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "Per CIBC Benefits Guide: after the $5,000 annual gas/EV category is exhausted, further gas (including Costco gas) earns 1%. Caps reset January 1. Cash back paid as annual Costco gift certificate.",
    sourceUrls: [
      "https://www.cibc.com/en/personal-banking/credit-cards/all-credit-cards/costco-mastercard.html",
      "https://www.cibc.com/content/dam/cibc-public-assets/personal-banking/credit-cards/all-credit-cards/costco/documents/cibc-costco-benefit-guide-en.pdf",
    ],
    lastVerified: VERIFIED,
  },

  // 5. Esso / Mobil ↔ PC Optimum ↔ PC Mastercards
  {
    id: "pc-optimum-esso-mobil",
    merchantBrandIds: ["esso", "mobil"],
    loyaltyProgramId: "pc-optimum",
    cardIds: [...PC_MASTERCARD_IDS],
    affiliation: "affiliated",
    requirements:
      "Scan / enter PC Optimum membership (or pay with PC Mastercard which identifies membership) at participating Esso or Mobil stations in Canada.",
    benefits: [
      {
        kind: "points_per_litre",
        amount: 10,
        summary: "10 PC Optimum points per whole litre for all PC Optimum members",
        appliesTo: "all_fuel_member_base",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "points_per_litre",
        amount: 30,
        summary:
          "At least 30 PC Optimum points per litre when paying with a PC Mastercard (member base + card bonus; ~3¢/L at 10 pts = 1¢)",
        appliesTo: "all_fuel_pc_mastercard",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "points_per_litre",
        amount: 10,
        summary:
          "Additional 10 points per litre on premium gasoline (octane 89+) with any PC Mastercard at Esso and select Mobil",
        appliesTo: "premium_fuel_pc_mastercard",
        pointCurrency: "PC Optimum",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "NOT Shell — PC Optimum's gas partners are Esso and Mobil only. Mobil rates beside Loblaw banner stores may be accelerated; check the station. PC Insiders WE can earn higher totals (up to ~70 pts/L) — card not in catalog.",
    sourceUrls: [
      "https://www.esso.ca/en-ca/pc-optimum-faq",
      "https://www.esso.ca/en-ca/pc-optimum-rewards",
      "https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/",
    ],
    lastVerified: VERIFIED,
  },

  // PC Optimum ↔ Shoppers / Pharmaprix
  {
    id: "pc-optimum-shoppers-pharmaprix",
    merchantBrandIds: ["shoppers-drug-mart", "pharmaprix"],
    loyaltyProgramId: "pc-optimum",
    cardIds: [...PC_MASTERCARD_IDS],
    affiliation: "affiliated",
    requirements: "Pay with the listed PC Mastercard at Shoppers Drug Mart or Pharmaprix.",
    benefits: [
      {
        kind: "cashback_percent",
        amount: 2.5,
        summary: "2.5% back in PC Optimum points with PC Mastercard (25 pts/$)",
        appliesTo: "pc-financial",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "cashback_percent",
        amount: 3.5,
        summary: "3.5% back in PC Optimum points with PC World Mastercard (35 pts/$)",
        appliesTo: "pc-financial-world",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "cashback_percent",
        amount: 4.5,
        summary: "4.5% back in PC Optimum points with PC World Elite Mastercard (45 pts/$)",
        appliesTo: "pc-financial-we",
        pointCurrency: "PC Optimum",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "Issuer quotes % back in points; underlying member base at Shoppers is 15 pts/$ plus card bonus. Totals above match PC Financial product pages.",
    sourceUrls: ["https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/"],
    lastVerified: VERIFIED,
  },

  // PC Optimum ↔ Loblaw grocery banners
  {
    id: "pc-optimum-loblaw-grocery",
    merchantBrandIds: ["loblaws", "no-frills", "real-canadian-superstore"],
    loyaltyProgramId: "pc-optimum",
    cardIds: [...PC_MASTERCARD_IDS],
    affiliation: "affiliated",
    requirements: "Pay with the listed PC Mastercard at participating Loblaw banner grocery stores.",
    benefits: [
      {
        kind: "cashback_percent",
        amount: 1,
        summary: "1% back in PC Optimum points with PC Mastercard",
        appliesTo: "pc-financial",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "cashback_percent",
        amount: 2,
        summary: "2% back in PC Optimum points with PC World Mastercard",
        appliesTo: "pc-financial-world",
        pointCurrency: "PC Optimum",
      },
      {
        kind: "cashback_percent",
        amount: 3,
        summary: "3% back in PC Optimum points with PC World Elite Mastercard",
        appliesTo: "pc-financial-we",
        pointCurrency: "PC Optimum",
      },
    ],
    stacksWithCardCategoryRewards: false,
    sourceUrls: ["https://www.pcfinancial.ca/en/credit-cards/pc-mastercard/"],
    lastVerified: VERIFIED,
  },

  // Scene+ ↔ Empire grocery / Lawtons ↔ Scotiabank Scene+ cards
  {
    id: "scene-plus-empire-scotia-cards",
    merchantBrandIds: [...EMPIRE_GROCERY_BRAND_IDS, "lawtons-drugs"],
    loyaltyProgramId: "scene-plus",
    cardIds: [...SCENE_PLUS_CARD_IDS],
    affiliation: "affiliated",
    requirements:
      "Pay with an eligible Scotiabank Scene+ credit card at participating Empire banners (list maintained by Scotiabank).",
    benefits: [
      {
        kind: "points_per_dollar",
        amount: 2,
        summary: "2 Scene+ points per $1 with Scene+ Visa at participating Empire grocers",
        appliesTo: "scotia-scene-visa",
        pointCurrency: "Scene+",
      },
      {
        kind: "points_per_dollar",
        amount: 3,
        summary:
          "3 Scene+ points per $1 with Passport Visa Infinite / Scene+ Visa Infinite at participating Empire grocers",
        appliesTo: "scotia-passport-vi|scotia-scene-vi",
        pointCurrency: "Scene+",
      },
      {
        kind: "points_per_dollar",
        amount: 6,
        summary: "6 Scene+ points per $1 CAD with Scotiabank Gold Amex at participating Empire grocers",
        appliesTo: "scotia-gold-amex",
        pointCurrency: "Scene+",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "Scanning a Scene+ membership card separately may unlock member offers; rates above are the credit-card accelerators published by Scotiabank. Eligible banner list can change.",
    sourceUrls: [
      "https://www.scotiabank.com/ca/en/personal/programs-services/participatingstores.html",
      "https://www.sobeys.com/sceneplus",
      "https://www.scotiabank.com/ca/en/personal/credit-cards/sceneplus.html",
    ],
    lastVerified: VERIFIED,
  },

  // Moi Rewards ↔ Metro banners ↔ linked RBC cards
  {
    id: "moi-rewards-rbc-linked",
    merchantBrandIds: [
      "metro",
      "food-basics",
      "super-c",
      "jean-coutu",
      "brunet",
    ],
    loyaltyProgramId: "moi-rewards",
    cardIds: [...RBC_MOI_LINK_CARD_IDS],
    affiliation: "linked",
    requirements:
      "Link eligible RBC debit/credit card to Moi Rewards via RBC Online Banking or avionrewards.com/moi. Scan Moi card and pay with the linked RBC card. moi RBC Visa holders cannot stack this link (already at max).",
    benefits: [
      {
        kind: "points_per_dollar",
        amount: 0.5,
        summary:
          "1 extra Moi point per $2 eligible spend (0.5 pts/$) after minimum basket thresholds",
        appliesTo: "linked_rbc_cards",
        pointCurrency: "Moi",
      },
    ],
    stacksWithCardCategoryRewards: true,
    notes:
      "Minimum baskets per Avion FAQ/terms: $60 at Metro / Food Basics / Super C; $40 at Jean Coutu / Brunet; $20 at Première Moisson. Extra Moi points are on top of base Moi earn.",
    sourceUrls: [
      "https://www.avionrewards.com/partnerships/moi-rewards/faq.html",
      "https://www.avionrewards.com/partnerships/moi-rewards/",
      "https://linkedloyalty.avionrewards.com/moi/linked-loyalty-terms-en.pdf",
    ],
    lastVerified: VERIFIED,
  },

  // Moi ↔ moi RBC Visa (co-brand)
  {
    id: "moi-rbc-visa-affiliated",
    merchantBrandIds: ["metro", "brunet", "jean-coutu"],
    loyaltyProgramId: "moi-rewards",
    cardIds: ["rbc-moi-visa"],
    affiliation: "affiliated",
    requirements:
      "Swipe Moi program card and pay with moi RBC Visa at participating stores (Quebec Metro / Brunet / Première Moisson; Jean Coutu in QC / ON / NB per issuer FAQ).",
    benefits: [
      {
        kind: "points_per_dollar",
        amount: 2,
        summary:
          "2 Moi points per $1 at participating Metro, Brunet, Première Moisson (QC) and Jean Coutu when Moi card is swiped",
        appliesTo: "participating_moi_banners",
        pointCurrency: "Moi",
      },
    ],
    stacksWithCardCategoryRewards: false,
    notes:
      "Issuer FAQ: Super C earns the regular 1 pt/$ card rate (not the 2× banner rate). Ontario/NB Moi for this co-brand is described as Jean Coutu; Ontario Metro/Food Basics use the separate linked-loyalty program for other RBC cards.",
    sourceUrls: [
      "https://www.rbcroyalbank.com/credit-cards/rewards/moi-rbc-visa.html",
    ],
    lastVerified: VERIFIED,
  },
];

// ── Lookups ─────────────────────────────────────────────────────────

export function getMerchantBrandById(id: string): MerchantBrand | undefined {
  return MERCHANT_BRANDS.find((b) => b.id === id);
}

export function getLoyaltyProgramById(id: string): LoyaltyProgram | undefined {
  return LOYALTY_PROGRAMS.find((p) => p.id === id);
}

export function getPartnershipById(
  id: string,
): MerchantPartnership | undefined {
  return MERCHANT_PARTNERSHIPS.find((p) => p.id === id);
}

export function getPartnershipsForBrand(
  brandId: string,
): MerchantPartnership[] {
  return MERCHANT_PARTNERSHIPS.filter((p) =>
    p.merchantBrandIds.includes(brandId),
  );
}

export function getPartnershipsForCard(
  cardId: string,
): MerchantPartnership[] {
  return MERCHANT_PARTNERSHIPS.filter((p) => p.cardIds.includes(cardId));
}

export function getPartnershipsForCategory(
  category: MerchantBrand["category"],
): MerchantPartnership[] {
  const brandIds = new Set(
    MERCHANT_BRANDS.filter((b) => b.category === category).map((b) => b.id),
  );
  return MERCHANT_PARTNERSHIPS.filter((p) =>
    p.merchantBrandIds.some((id) => brandIds.has(id)),
  );
}
