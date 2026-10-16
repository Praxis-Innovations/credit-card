import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

type Card = { id: string; name: string; issuer: string };
type CardList = {
  data: Card[];
  meta: { total: number; limit: number; offset: number };
};
type ErrorBody = { error: { code: string; message: string } };

test.describe("GET /v1/cards", () => {
  test("lists cards with pagination meta", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards?limit=5&offset=0"), {
      headers: apiAuthHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as CardList;
    expect(body.data).toHaveLength(5);
    expect(body.meta.total).toBeGreaterThan(5);
    expect(body.meta.limit).toBe(5);
    expect(body.meta.offset).toBe(0);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      issuer: expect.any(String),
    });
  });

  test("returns a single card by id", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards/amex-cobalt"), {
      headers: apiAuthHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Card;
    expect(body).toMatchObject({ id: "amex-cobalt", name: "Cobalt" });
  });

  test("returns not_found for an unknown card", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards/not-a-real-card"), {
      headers: apiAuthHeaders(),
    });
    expect(res.status()).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
  });
});
