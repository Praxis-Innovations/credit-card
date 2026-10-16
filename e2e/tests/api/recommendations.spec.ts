import type { APIRequestContext } from "@playwright/test";
import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

type RecommendationResponse = {
  bestCardId: string;
  purchase: {
    mcc?: string | null;
    displayCategory?: string | null;
    matchKind?: string | null;
    merchantBrandId?: string | null;
  };
  recommendations: Array<{
    rank: number;
    card: { id: string };
    earnRate?: number;
  }>;
};

type ErrorBody = { error: { code: string; message: string } };

function recommend(request: APIRequestContext, body: Record<string, unknown>) {
  return request.post(apiUrl("/v1/recommendations"), {
    headers: {
      ...apiAuthHeaders(),
      "content-type": "application/json",
    },
    data: body,
  });
}

test.describe("POST /v1/recommendations", () => {
  test("ranks owned cards for an MCC (groceries 5411)", async ({ request }) => {
    const res = await recommend(request, {
      amountCad: 100,
      mcc: "5411",
      ownedCardIds: ["amex-cobalt", "tangerine-moneyback"],
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as RecommendationResponse;
    expect(body.purchase).toMatchObject({
      mcc: "5411",
      displayCategory: "groceries",
    });
    expect(body.bestCardId).toBe("amex-cobalt");
    expect(body.recommendations[0]?.rank).toBe(1);
    expect(body.recommendations[0]?.card.id).toBe("amex-cobalt");
    expect(body.recommendations[0]?.earnRate).toBe(5);
  });

  test("ranks via merchantQuery without a legacy category field", async ({ request }) => {
    const res = await recommend(request, {
      amountCad: 60,
      merchantQuery: "Shell",
      ownedCardIds: ["scotia-scene-vi", "tangerine-moneyback"],
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as RecommendationResponse;
    expect(body.purchase.merchantBrandId).toBe("shell");
    expect(body.bestCardId).toBeTruthy();
    expect(body.recommendations.length).toBeGreaterThan(0);
  });

  test("rejects legacy category with a clear bad_request", async ({ request }) => {
    const res = await recommend(request, {
      amountCad: 50,
      category: "gas",
      ownedCardIds: ["triangle-we"],
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toMatch(/category was removed/i);
  });

  test("returns empty_wallet when ownedCardIds is empty", async ({ request }) => {
    const res = await recommend(request, {
      amountCad: 50,
      mcc: "5411",
      ownedCardIds: [],
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("empty_wallet");
  });
});
