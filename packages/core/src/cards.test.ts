import { describe, expect, it } from "vitest";
import { CARDS, getCardById } from "./cards";
import {
  CATEGORIES,
  ISSUERS,
  POINT_CURRENCIES,
  type Category,
  type CreditCard,
  type Issuer,
  type PointCurrency,
} from "./schema";
import { DEFAULT_POINT_VALUATIONS } from "./valuations";

const NETWORKS = new Set(["Visa", "Mastercard", "Amex"]);
const CATEGORY_SET = new Set<string>(CATEGORIES);
const ISSUER_SET = new Set<string>(ISSUERS);
const CURRENCY_SET = new Set<string>(POINT_CURRENCIES);

/** Upper bound for earnRate (points or cashback % per $). Cobalt-style 5× is common; allow headroom. */
const MAX_EARN_RATE = 20;
/** Caps are spend dollars CAD — reject negatives and absurd multi-million values. */
const MAX_CAP_DOLLARS = 500_000;
/** Annual fees in CAD — reject negatives and absurd values. */
const MAX_ANNUAL_FEE = 5_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertRequiredCreditCardFields(card: CreditCard, index: number): void {
  const label = `CARDS[${index}] (${card.id ?? "missing-id"})`;

  expect(typeof card.id, `${label}.id`).toBe("string");
  expect(card.id.length, `${label}.id non-empty`).toBeGreaterThan(0);
  expect(card.id, `${label}.id slug`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

  expect(ISSUER_SET.has(card.issuer), `${label}.issuer ${card.issuer}`).toBe(
    true,
  );
  expect(typeof card.name, `${label}.name`).toBe("string");
  expect(card.name.trim().length, `${label}.name non-empty`).toBeGreaterThan(0);

  expect(typeof card.annualFee, `${label}.annualFee`).toBe("number");
  expect(Number.isFinite(card.annualFee), `${label}.annualFee finite`).toBe(
    true,
  );

  expect(
    CURRENCY_SET.has(card.pointCurrency),
    `${label}.pointCurrency ${card.pointCurrency}`,
  ).toBe(true);
  expect(
    card.pointCurrency in DEFAULT_POINT_VALUATIONS,
    `${label}.pointCurrency has default valuation`,
  ).toBe(true);

  expect(Array.isArray(card.rewardCategories), `${label}.rewardCategories`).toBe(
    true,
  );
  expect(
    card.rewardCategories.length,
    `${label}.rewardCategories non-empty`,
  ).toBeGreaterThan(0);

  expect(typeof card.lastVerified, `${label}.lastVerified`).toBe("string");

  if (card.network !== undefined) {
    expect(NETWORKS.has(card.network), `${label}.network`).toBe(true);
  }
  if (card.tier !== undefined) {
    expect(typeof card.tier, `${label}.tier`).toBe("string");
    expect(card.tier.trim().length, `${label}.tier non-empty`).toBeGreaterThan(
      0,
    );
  }
  if (card.welcomeOffer !== undefined) {
    expect(typeof card.welcomeOffer.summary, `${label}.welcomeOffer.summary`).toBe(
      "string",
    );
    expect(
      card.welcomeOffer.summary.trim().length,
      `${label}.welcomeOffer.summary non-empty`,
    ).toBeGreaterThan(0);
    if (card.welcomeOffer.estimatedValueCad !== undefined) {
      expect(
        Number.isFinite(card.welcomeOffer.estimatedValueCad),
        `${label}.welcomeOffer.estimatedValueCad`,
      ).toBe(true);
      expect(card.welcomeOffer.estimatedValueCad).toBeGreaterThanOrEqual(0);
    }
  }
}

describe("CARDS dataset validation", () => {
  it("has a substantial Canadian catalog", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(55);
    expect(CARDS.length).toBeLessThanOrEqual(80);
  });

  it("conforms every card to the CreditCard schema (required fields + enums)", () => {
    CARDS.forEach((card, index) => {
      assertRequiredCreditCardFields(card, index);
    });
  });

  it("has no duplicate card IDs", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const card of CARDS) {
      expect(getCardById(card.id)).toBe(card);
    }
  });

  it("keeps reward rates and caps within sane bounds", () => {
    for (const card of CARDS) {
      expect(card.annualFee).toBeGreaterThanOrEqual(0);
      expect(card.annualFee).toBeLessThanOrEqual(MAX_ANNUAL_FEE);

      const seenCategories = new Set<Category>();
      for (const reward of card.rewardCategories) {
        expect(CATEGORY_SET.has(reward.category)).toBe(true);
        expect(seenCategories.has(reward.category)).toBe(false);
        seenCategories.add(reward.category);

        expect(Number.isFinite(reward.earnRate)).toBe(true);
        expect(reward.earnRate).toBeGreaterThan(0);
        expect(reward.earnRate).toBeLessThanOrEqual(MAX_EARN_RATE);

        if (reward.capMonthly !== undefined) {
          expect(Number.isFinite(reward.capMonthly)).toBe(true);
          expect(reward.capMonthly).toBeGreaterThan(0);
          expect(reward.capMonthly).toBeLessThanOrEqual(MAX_CAP_DOLLARS);
        }
        if (reward.capAnnual !== undefined) {
          expect(Number.isFinite(reward.capAnnual)).toBe(true);
          expect(reward.capAnnual).toBeGreaterThan(0);
          expect(reward.capAnnual).toBeLessThanOrEqual(MAX_CAP_DOLLARS);
        }
      }

      // Every card should define a catch-all "other" rate for ranking fallbacks.
      expect(seenCategories.has("other")).toBe(true);
    }
  });

  it("uses valid, parseable lastVerified ISO dates", () => {
    const today = new Date();
    // Allow a little clock skew / CI timezone drift past "today".
    const maxAllowed = new Date(today);
    maxAllowed.setUTCDate(maxAllowed.getUTCDate() + 2);

    for (const card of CARDS) {
      expect(card.lastVerified).toMatch(ISO_DATE);

      const [year, month, day] = card.lastVerified.split("-").map(Number);
      expect(year).toBeGreaterThanOrEqual(2020);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);

      const parsed = new Date(`${card.lastVerified}T00:00:00.000Z`);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      // Round-trip: Date must represent the same calendar day (rejects 2026-02-31 etc.).
      expect(parsed.toISOString().slice(0, 10)).toBe(card.lastVerified);
      expect(parsed.getTime()).toBeLessThanOrEqual(maxAllowed.getTime());
    }
  });

  it("covers every configured issuer and point currency at least once when listed on a card", () => {
    const usedIssuers = new Set(CARDS.map((c) => c.issuer));
    const usedCurrencies = new Set(CARDS.map((c) => c.pointCurrency));

    for (const issuer of usedIssuers) {
      expect(ISSUER_SET.has(issuer as Issuer)).toBe(true);
    }
    for (const currency of usedCurrencies) {
      expect(CURRENCY_SET.has(currency as PointCurrency)).toBe(true);
      expect(
        typeof DEFAULT_POINT_VALUATIONS[currency as PointCurrency],
      ).toBe("number");
      expect(
        DEFAULT_POINT_VALUATIONS[currency as PointCurrency],
      ).toBeGreaterThan(0);
    }
  });
});
