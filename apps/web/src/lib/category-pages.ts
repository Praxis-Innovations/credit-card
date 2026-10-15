import {
  CATALOG,
  cardDisplayName,
  dollarsBack,
  formatDollars,
  isCashback,
  oldestLastVerified,
  rankCatalogCards,
} from "@/lib/catalog";
import type { CategoryId, RankedCatalogCard } from "@/lib/catalog";
import type { Faq } from "@/lib/faq";

export const DEFAULT_AMOUNT = 100;

/** Up to three cards a visitor can compare in the calculator. */
export const MAX_PICKS = 3;

/** Rows in the "Top cards for <category>" table. */
export const TOP_CARDS_COUNT = 10;

export type CategoryPage = {
  id: CategoryId;
  path: `/${CategoryId}`;
  /** Nav, breadcrumb and table label, e.g. "Gas". */
  label: string;
  /** In-sentence noun for "on <noun>", e.g. "gas", "restaurants". */
  noun: string;
  /** "on gas", "at restaurants". */
  onNoun: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  /** What the amount is, e.g. "a fill-up". */
  purchase: string;
  /** Calculator cards before the visitor picks their own. */
  defaultPicks: string[];
  extraFaqs: Faq[];
};

const POINTS_VS_CASH_FAQ: Faq = {
  question: "Is a cash back card or a points card better?",
  answer:
    "It depends on what the points are worth to you. NorthTap values each points program at a fixed estimate (for example Aeroplan at 2¢ a point) so cash back and points compare in dollars. If you value points differently, your ranking can change.",
};

export const CATEGORY_PAGES: readonly CategoryPage[] = [
  {
    id: "gas",
    path: "/gas",
    label: "Gas",
    noun: "gas",
    onNoun: "on gas",
    h1: "Which credit card to use for gas in Canada",
    title: "Which credit card to use for gas in Canada · NorthTap",
    description:
      "See which Canadian credit card earns the most on gas. Compare up to three cards on a fill-up, ranked in dollars back, plus the top cards for gas.",
    intro:
      "Not sure which credit card to use for gas? Earn rates at the pump differ a lot between cards. Pick up to three cards and see what each gives back on a fill-up, ranked, in dollars.",
    purchase: "a fill-up",
    defaultPicks: ["triangle-we", "amex-cobalt", "td-aeroplan-vi"],
    extraFaqs: [
      {
        question: "Do gas station loyalty programs stack with my credit card?",
        answer:
          "Often, yes. Many gas brands run their own loyalty program, and you can usually earn its points on top of what your card earns. This page compares card earn rates only; the NorthTap app also counts supported gas partnerships when you pick a station.",
      },
      POINTS_VS_CASH_FAQ,
    ],
  },
  {
    id: "groceries",
    path: "/groceries",
    label: "Groceries",
    noun: "groceries",
    onNoun: "on groceries",
    h1: "Which credit card to use for groceries in Canada",
    title: "Which credit card to use for groceries in Canada · NorthTap",
    description:
      "See which Canadian credit card earns the most on groceries. Compare up to three cards on a grocery run, ranked in dollars back, plus the top cards for groceries.",
    intro:
      "Groceries are one of the biggest monthly costs, so the card you tap adds up. If you're wondering which credit card to use for groceries, pick up to three cards and see what each gives back, ranked, in dollars.",
    purchase: "a grocery run",
    defaultPicks: ["amex-cobalt", "scotia-gold-amex", "pc-financial-we"],
    extraFaqs: [
      {
        question: "Do warehouse clubs and superstores count as groceries?",
        answer:
          "Not always. Card issuers decide by the store's merchant category code, and many code warehouse clubs, big-box stores and pharmacies outside groceries. Check your card's terms for the stores you shop at most.",
      },
      {
        question: "Are there caps on grocery rewards?",
        answer:
          "Some cards cap their bonus rate, for example at a monthly spending limit; past the cap you earn the base rate. Caps are noted in the table of top cards above.",
      },
    ],
  },
  {
    id: "dining",
    path: "/dining",
    label: "Dining",
    noun: "restaurants",
    onNoun: "at restaurants",
    h1: "Which credit card to use at restaurants in Canada",
    title: "Which credit card to use at restaurants in Canada · NorthTap",
    description:
      "See which Canadian credit card earns the most at restaurants. Compare up to three cards on a meal out, ranked in dollars back, plus the top cards for dining.",
    intro:
      "Dining rates are where cards differ the most. Before you pay the bill, find out which credit card to use at restaurants: pick up to three cards and see what each gives back, ranked, in dollars.",
    purchase: "a meal out",
    defaultPicks: ["amex-cobalt", "scotia-gold-amex", "td-aeroplan-vi"],
    extraFaqs: [
      {
        question: "Do food delivery and coffee shops count as dining?",
        answer:
          "Usually restaurants, bars, cafés and many food delivery apps count as dining, but it is up to the card issuer and the merchant's category code. Check your card's terms if a purchase doesn't earn the rate you expect.",
      },
      POINTS_VS_CASH_FAQ,
    ],
  },
];

export function getCategoryPage(id: string): CategoryPage | undefined {
  return CATEGORY_PAGES.find((page) => page.id === id);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** First FAQ answer, worded from the current catalog ranking. */
export function topEarnerFaq(page: CategoryPage, ranked: RankedCatalogCard[]): Faq {
  const question = `Which credit card earns the most ${page.onNoun} in Canada?`;
  const top = ranked[0];
  if (!top) {
    return { question, answer: "Compare the cards you carry with the calculator above." };
  }
  const leaders = ranked.filter((r) => r.centsPerDollar === top.centsPerDollar);
  const names = leaders.slice(0, 3).map((r) => cardDisplayName(r.card));
  const more = leaders.length > 3 ? ` (and ${leaders.length - 3} more)` : "";
  const subject =
    leaders.length > 1
      ? `${joinNames(names)}${more} tie for the most`
      : `${names[0]} earns the most`;
  const valuation = isCashback(top.card)
    ? ""
    : `, valuing ${top.card.pointCurrency} at ${top.pointValue}¢ a point`;
  return {
    question,
    answer: `In NorthTap's catalog, ${subject} ${page.onNoun}: ${formatDollars(
      dollarsBack(DEFAULT_AMOUNT, top.centsPerDollar),
    )} back on $${DEFAULT_AMOUNT}${valuation}. The best card for you depends on the cards you already carry, so compare yours with the calculator.`,
  };
}

export type CategoryPageData = {
  page: CategoryPage;
  ranked: RankedCatalogCard[];
  topCards: RankedCatalogCard[];
  faqs: Faq[];
  /** ISO date; every rate on the page was checked on or after it. */
  ratesLastChecked: string;
};

export function getCategoryPageData(page: CategoryPage): CategoryPageData {
  const ranked = rankCatalogCards(page.id);
  return {
    page,
    ranked,
    topCards: ranked.slice(0, TOP_CARDS_COUNT),
    faqs: [topEarnerFaq(page, ranked), ...page.extraFaqs],
    ratesLastChecked: oldestLastVerified(CATALOG.cards),
  };
}
