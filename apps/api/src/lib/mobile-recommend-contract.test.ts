/**
 * Contract: payloads shaped like apps/mobile `recommendationRequestFor`
 * must pass API route validation (no 400 from map/field checks).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { POST as postRecommendations } from "../app/v1/recommendations/route";
import {
  clearStaticApiKeys,
  registerStaticApiKey,
} from "./auth";
import { resetRateLimits } from "./rate-limit";

process.env.NORTHTAP_CATALOG_SOURCE = "static";

const TEST_API_KEY = "test-api-key-not-a-production-secret";

/** Mirrors apps/mobile/src/lib/recommend.ts recommendationRequestFor. */
function recommendationRequestFor(
  store: {
    name: string;
    category: string;
    osmTag?: string | null;
    source: "nearby" | "browse" | "search" | "category";
  },
  amountCad: number,
  ownedCardIds: string[],
): Record<string, unknown> {
  if (store.source === "category") {
    return {
      amountCad,
      categoryFallback: store.category,
      ownedCardIds,
      limit: 10,
    };
  }
  return {
    amountCad,
    merchantQuery: store.name,
    ...(store.osmTag ? { osmTag: store.osmTag } : {}),
    ...(store.source === "search" ? { categoryFallback: store.category } : {}),
    ownedCardIds,
    limit: 10,
  };
}

beforeEach(() => {
  resetRateLimits();
  clearStaticApiKeys();
  registerStaticApiKey(TEST_API_KEY);
});

describe("mobile recommendationRequestFor ↔ API contract", () => {
  it.each([
    {
      label: "bare category chip",
      store: {
        name: "Groceries",
        category: "groceries",
        source: "category" as const,
      },
      amountCad: 100,
    },
    {
      label: "nearby with osmTag",
      store: {
        name: "Shell",
        category: "gas",
        osmTag: "amenity=fuel",
        source: "nearby" as const,
      },
      amountCad: 40,
    },
    {
      label: "browse without osmTag",
      store: {
        name: "Shell",
        category: "gas",
        source: "browse" as const,
      },
      amountCad: 60,
    },
    {
      label: "search with categoryFallback",
      store: {
        name: "Some Cafe",
        category: "dining",
        source: "search" as const,
      },
      amountCad: 25,
    },
  ])("$label payloads are accepted by POST /v1/recommendations", async ({
    store,
    amountCad,
  }) => {
    const body = recommendationRequestFor(store, amountCad, [
      "amex-cobalt",
      "tangerine-moneyback",
    ]);
    const res = await postRecommendations(
      new Request("http://localhost:8787/v1/recommendations", {
        method: "POST",
        headers: {
          "X-Api-Key": TEST_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { bestCardId: string | null };
    expect(json.bestCardId).toBeTruthy();
  });
});
