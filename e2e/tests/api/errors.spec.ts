import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

test.describe("API error contract", () => {
  test("unauthorized errors use the shared error envelope", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/merchant-brands?limit=1"));
    expect(res.status()).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error).toMatchObject({
      code: "unauthorized",
      message: expect.any(String),
    });
  });

  test("not_found errors use the shared error envelope", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/cards/missing-card-id"), {
      headers: apiAuthHeaders(),
    });
    expect(res.status()).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toMatch(/not found/i);
  });

  test("bad_request when recommendation body omits mcc and store", async ({
    request,
  }) => {
    const res = await request.post(apiUrl("/v1/recommendations"), {
      headers: {
        ...apiAuthHeaders(),
        "content-type": "application/json",
      },
      data: {
        amountCad: 40,
        ownedCardIds: ["amex-cobalt"],
      },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toMatch(/mcc|merchantQuery|categoryFallback/i);
  });

  test("rejects non-JSON recommendation bodies", async ({ request }) => {
    const res = await request.post(apiUrl("/v1/recommendations"), {
      headers: {
        ...apiAuthHeaders(),
        "content-type": "application/json",
      },
      data: "not-json",
    });
    // Playwright may send a string as raw body; assert 400 either way.
    expect(res.status()).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("bad_request");
  });
});
