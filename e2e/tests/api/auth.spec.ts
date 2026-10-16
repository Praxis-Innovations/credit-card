import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

type ErrorBody = { error: { code: string; message: string } };

test.describe("API auth", () => {
  test("rejects requests with no API key", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards?limit=1"));
    expect(res.status()).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("unauthorized");
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  test("rejects an invalid API key", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards?limit=1"), {
      headers: apiAuthHeaders({ "x-api-key": "nt_live_bogus_not_real" }),
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("unauthorized");
  });

  test("accepts the local E2E API key on a protected route", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards?limit=1"), {
      headers: apiAuthHeaders(),
    });
    expect(res.ok()).toBeTruthy();
  });

  test("health stays public", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/health"));
    expect(res.ok()).toBeTruthy();
  });
});
