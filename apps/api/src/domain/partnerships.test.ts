import { describe, expect, it } from "vitest";
import { CARDS, getCardById } from "./cards";
import {
  getLoyaltyProgramById,
  getMerchantBrandById,
  getPartnershipById,
  getPartnershipsForBrand,
  getPartnershipsForCard,
  getPartnershipsForCategory,
  LOYALTY_PROGRAMS,
  MERCHANT_BRANDS,
  MERCHANT_PARTNERSHIPS,
} from "./partnerships";
import {
  CARD_AFFILIATIONS,
  CATEGORIES,
  PARTNERSHIP_BENEFIT_KINDS,
  POINT_CURRENCIES,
  type CardAffiliation,
  type Category,
  type PartnershipBenefitKind,
  type PointCurrency,
} from "./schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_URL = /^https:\/\/.+/i;

const CATEGORY_SET = new Set<string>(CATEGORIES);
const AFFILIATION_SET = new Set<string>(CARD_AFFILIATIONS);
const BENEFIT_KIND_SET = new Set<string>(PARTNERSHIP_BENEFIT_KINDS);
const CURRENCY_SET = new Set<string>(POINT_CURRENCIES);
const CARD_ID_SET = new Set(CARDS.map((c) => c.id));
const BRAND_ID_SET = new Set(MERCHANT_BRANDS.map((b) => b.id));
const PROGRAM_ID_SET = new Set(LOYALTY_PROGRAMS.map((p) => p.id));

/** Strings that must never appear in production partnership data. */
const FORBIDDEN_DATA_MARKERS = [
  /\bmock\b/i,
  /\bplaceholder\b/i,
  /\bsynthetic\b/i,
  /\bfake\b/i,
  /\blorem\b/i,
  /\bexample\.com\b/i,
  /\bTODO\b/,
  /\bTBD\b/,
  /\bfixture\b/i,
];

describe("merchant brands", () => {
  it("has unique slug ids and required citation fields", () => {
    const ids = MERCHANT_BRANDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const [index, brand] of MERCHANT_BRANDS.entries()) {
      const label = `MERCHANT_BRANDS[${index}] (${brand.id})`;
      expect(brand.id, label).toMatch(SLUG);
      expect(brand.name.trim().length, label).toBeGreaterThan(0);
      expect(CATEGORY_SET.has(brand.category), `${label} category`).toBe(true);
      expect(brand.sourceUrl, label).toMatch(HTTPS_URL);
      expect(brand.lastVerified, label).toMatch(ISO_DATE);
    }
  });
});

describe("loyalty programs", () => {
  it("has unique slug ids and required citation fields", () => {
    const ids = LOYALTY_PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const [index, program] of LOYALTY_PROGRAMS.entries()) {
      const label = `LOYALTY_PROGRAMS[${index}] (${program.id})`;
      expect(program.id, label).toMatch(SLUG);
      expect(program.name.trim().length, label).toBeGreaterThan(0);
      expect(program.sourceUrl, label).toMatch(HTTPS_URL);
      expect(program.lastVerified, label).toMatch(ISO_DATE);
      if (program.pointCurrency !== undefined) {
        expect(
          CURRENCY_SET.has(program.pointCurrency),
          `${label} pointCurrency`,
        ).toBe(true);
      }
    }
  });
});

describe("merchant partnerships", () => {
  it("has unique slug ids", () => {
    const ids = MERCHANT_PARTNERSHIPS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only known brands, programs, and catalog cards", () => {
    for (const [index, partnership] of MERCHANT_PARTNERSHIPS.entries()) {
      const label = `MERCHANT_PARTNERSHIPS[${index}] (${partnership.id})`;

      expect(partnership.merchantBrandIds.length, label).toBeGreaterThan(0);
      for (const brandId of partnership.merchantBrandIds) {
        expect(BRAND_ID_SET.has(brandId), `${label} brand ${brandId}`).toBe(
          true,
        );
      }

      if (partnership.loyaltyProgramId === null) {
        expect(partnership.affiliation, label).toBe("direct");
      } else {
        expect(
          PROGRAM_ID_SET.has(partnership.loyaltyProgramId),
          `${label} program ${partnership.loyaltyProgramId}`,
        ).toBe(true);
      }

      expect(partnership.cardIds.length, label).toBeGreaterThan(0);
      for (const cardId of partnership.cardIds) {
        expect(CARD_ID_SET.has(cardId), `${label} card ${cardId}`).toBe(true);
        expect(getCardById(cardId), `${label} getCardById(${cardId})`).toBeDefined();
      }

      expect(
        AFFILIATION_SET.has(partnership.affiliation),
        `${label} affiliation`,
      ).toBe(true);
      expect(partnership.requirements.trim().length, label).toBeGreaterThan(0);
      expect(partnership.benefits.length, label).toBeGreaterThan(0);
      expect(partnership.sourceUrls.length, label).toBeGreaterThan(0);
      for (const url of partnership.sourceUrls) {
        expect(url, `${label} sourceUrl`).toMatch(HTTPS_URL);
      }
      expect(partnership.lastVerified, label).toMatch(ISO_DATE);
      expect(typeof partnership.stacksWithCardCategoryRewards, label).toBe(
        "boolean",
      );
    }
  });

  it("has well-formed benefits", () => {
    for (const partnership of MERCHANT_PARTNERSHIPS) {
      for (const [bIndex, benefit] of partnership.benefits.entries()) {
        const label = `${partnership.id}.benefits[${bIndex}]`;
        expect(
          BENEFIT_KIND_SET.has(benefit.kind),
          `${label} kind`,
        ).toBe(true);
        expect(Number.isFinite(benefit.amount), `${label} amount`).toBe(true);
        expect(benefit.amount, `${label} amount`).toBeGreaterThan(0);
        expect(benefit.summary.trim().length, label).toBeGreaterThan(0);

        if (benefit.pointCurrency !== undefined) {
          expect(
            CURRENCY_SET.has(benefit.pointCurrency),
            `${label} pointCurrency`,
          ).toBe(true);
        }
        if (benefit.promotionalEnds !== undefined) {
          expect(benefit.promotionalEnds, label).toMatch(ISO_DATE);
          expect(benefit.promotional, label).toBe(true);
        }
        if (benefit.capLitresMonthly !== undefined) {
          expect(benefit.capLitresMonthly, label).toBeGreaterThan(0);
        }
        if (benefit.capLitresPerFill !== undefined) {
          expect(benefit.capLitresPerFill, label).toBeGreaterThan(0);
        }
        if (benefit.capAnnualSpendCad !== undefined) {
          expect(benefit.capAnnualSpendCad, label).toBeGreaterThan(0);
        }
      }
    }
  });

  it("contains no mock / placeholder / synthetic markers", () => {
    const blob = JSON.stringify({
      MERCHANT_BRANDS,
      LOYALTY_PROGRAMS,
      MERCHANT_PARTNERSHIPS,
    });
    for (const marker of FORBIDDEN_DATA_MARKERS) {
      expect(blob, String(marker)).not.toMatch(marker);
    }
  });

  it("includes the four session-verified seed partnerships", () => {
    expect(getPartnershipById("shell-scene-scotia-scene-cards")).toBeDefined();
    expect(getPartnershipById("journie-cibc-gas-discount")).toBeDefined();
    expect(getPartnershipById("triangle-gas-plus-petro-canada")).toBeDefined();
    expect(getPartnershipById("costco-cibc-mastercard-direct")).toBeDefined();
  });

  it("documents PC Optimum at Esso/Mobil and never at Shell", () => {
    const pcGas = getPartnershipById("pc-optimum-esso-mobil");
    expect(pcGas).toBeDefined();
    expect(pcGas!.merchantBrandIds).toEqual(
      expect.arrayContaining(["esso", "mobil"]),
    );
    expect(pcGas!.merchantBrandIds).not.toContain("shell");

    const shellPartnerships = getPartnershipsForBrand("shell");
    for (const p of shellPartnerships) {
      expect(p.loyaltyProgramId).not.toBe("pc-optimum");
    }
  });

  it("models Costco gas as a direct card partnership with no loyalty layer", () => {
    const costco = getPartnershipById("costco-cibc-mastercard-direct");
    expect(costco?.loyaltyProgramId).toBeNull();
    expect(costco?.affiliation).toBe("direct" satisfies CardAffiliation);
    expect(costco?.cardIds).toEqual(["cibc-costco-mc"]);
  });
});

describe("partnership lookups", () => {
  it("resolves brands, programs, and filtered lists", () => {
    expect(getMerchantBrandById("shell")?.name).toBe("Shell");
    expect(getLoyaltyProgramById("scene-plus")?.pointCurrency).toBe(
      "Scene+" satisfies PointCurrency,
    );
    expect(getPartnershipsForBrand("shell").length).toBeGreaterThan(0);
    expect(getPartnershipsForCard("cibc-costco-mc").length).toBeGreaterThan(0);
    expect(
      getPartnershipsForCategory("gas" satisfies Category).length,
    ).toBeGreaterThan(0);
  });

  it("covers gas, groceries, drugstore, and warehouse-adjacent categories", () => {
    const categories = new Set(
      MERCHANT_BRANDS.map((b) => b.category as Category),
    );
    expect(categories.has("gas")).toBe(true);
    expect(categories.has("groceries")).toBe(true);
    expect(categories.has("drugstore")).toBe(true);
  });
});

describe("partnership benefit kinds enum", () => {
  it("exports the expected benefit kinds", () => {
    const kinds: PartnershipBenefitKind[] = [
      "cents_per_litre_instant",
      "cents_per_litre_rewards",
      "points_per_litre",
      "points_per_dollar",
      "cashback_percent",
    ];
    expect([...PARTNERSHIP_BENEFIT_KINDS].sort()).toEqual([...kinds].sort());
  });
});
