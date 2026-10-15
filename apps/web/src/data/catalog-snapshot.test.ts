/**
 * The only place apps/web touches apps/api source: checks that the committed
 * snapshot is current and that the site's ranking matches the API's.
 */
import { describe, expect, it } from "vitest";
import { CARDS } from "../../../api/src/domain/cards";
import { recommendCards } from "../../../api/src/domain/recommend";
import { buildCatalogSnapshot } from "../../../../scripts/catalog-snapshot";
import { CATEGORY_PAGES } from "@/lib/category-pages";
import { rankCatalogCards } from "@/lib/catalog";
import snapshot from "./catalog-snapshot.json";

describe("catalog snapshot freshness", () => {
  it("matches apps/api/src/domain (run `pnpm snapshot:catalog` if this fails)", () => {
    expect(snapshot).toEqual(buildCatalogSnapshot());
  });

  it("carries each card's lastVerified date from the source", () => {
    const source = new Map(CARDS.map((card) => [card.id, card.lastVerified]));
    for (const card of snapshot.cards) {
      expect(card.lastVerified).toBe(source.get(card.id));
    }
  });
});

describe("ranking parity with the API", () => {
  const allIds = CARDS.map((card) => card.id);

  it.each(CATEGORY_PAGES.map((page) => page.id))(
    "%s: same order and cents per dollar as recommendCards over the full catalog",
    (category) => {
      const api = recommendCards({ ownedCardIds: allIds, category });
      const web = rankCatalogCards(category);
      expect(web.map((r) => r.card.id)).toEqual(api.map((r) => r.card.id));
      web.forEach((r, i) => {
        expect(r.centsPerDollar).toBeCloseTo(api[i]!.centsPerDollar, 10);
        expect(r.earnRate).toBe(api[i]!.earnRate);
        expect(r.pointValue).toBe(api[i]!.pointValue);
      });
    },
  );

  it.each(CATEGORY_PAGES.map((page) => [page.id, page.defaultPicks] as const))(
    "%s: the calculator's default cards rank the same as the API",
    (category, picks) => {
      const api = recommendCards({ ownedCardIds: [...picks], category });
      const web = rankCatalogCards(category).filter((r) => picks.includes(r.card.id));
      expect(web.map((r) => r.card.id)).toEqual(api.map((r) => r.card.id));
    },
  );
});
