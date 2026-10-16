import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

test.describe("api smoke", () => {
  test("GET /v1/health is ok", { tag: "@smoke" }, async ({ request }) => {
    const res = await request.get(apiUrl("/v1/health"));
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "northtap-api",
    });
  });

  test("GET /v1/cards accepts the local E2E API key", { tag: "@smoke" }, async ({
    request,
  }) => {
    const res = await request.get(apiUrl("/v1/cards?limit=1"), {
      headers: apiAuthHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
  });
});
