import { apiAuthHeaders, apiUrl } from "../../src/helpers/api";
import { expect, test } from "../../src/fixtures";

type Brand = { id: string; name: string; category: string };
type BrandList = {
  data: Brand[];
  meta: { total: number; limit: number; offset: number };
};
type ErrorBody = { error: { code: string; message: string } };

test.describe("GET /v1/merchant-brands", () => {
  test("lists and searches merchant brands", async ({ request }) => {
    const list = await request.get(apiUrl("/v1/merchant-brands?limit=10"), {
      headers: apiAuthHeaders(),
    });
    expect(list.ok()).toBeTruthy();
    const listBody = (await list.json()) as BrandList;
    expect(listBody.data.length).toBeGreaterThan(0);
    expect(listBody.meta.total).toBeGreaterThan(0);

    const search = await request.get(apiUrl("/v1/merchant-brands?q=shell&limit=10"), {
      headers: apiAuthHeaders(),
    });
    expect(search.ok()).toBeTruthy();
    const searchBody = (await search.json()) as BrandList;
    expect(searchBody.data.some((b) => b.id === "shell")).toBeTruthy();
  });

  test("returns a brand by id", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/merchant-brands/shell"), {
      headers: apiAuthHeaders(),
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as Brand;
    expect(body).toMatchObject({ id: "shell", name: "Shell" });
  });

  test("returns not_found for an unknown brand", async ({ request }) => {
    const res = await request.get(apiUrl("/v1/merchant-brands/not-a-brand"), {
      headers: apiAuthHeaders(),
    });
    expect(res.status()).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe("not_found");
  });
});
