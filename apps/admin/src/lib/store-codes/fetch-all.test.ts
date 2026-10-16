import { describe, expect, it, vi } from "vitest";
import { fetchAllRows, SUPABASE_PAGE_SIZE } from "./fetch-all";

describe("fetchAllRows", () => {
  it("stops after a short page under the PostgREST cap", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: "a" }, { id: "b" }],
      error: null,
    }));
    const { data, error } = await fetchAllRows(fetchPage, SUPABASE_PAGE_SIZE);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, SUPABASE_PAGE_SIZE - 1);
  });

  it("pages past 1,000 rows until a short page returns", async () => {
    const page1 = Array.from({ length: SUPABASE_PAGE_SIZE }, (_, i) => ({ id: `b${i}` }));
    const page2 = Array.from({ length: 250 }, (_, i) => ({
      id: `b${SUPABASE_PAGE_SIZE + i}`,
    }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    const { data, error } = await fetchAllRows<{ id: string }>(fetchPage);

    expect(error).toBeNull();
    expect(data).toHaveLength(SUPABASE_PAGE_SIZE + 250);
    expect(data[0]?.id).toBe("b0");
    expect(data.at(-1)?.id).toBe(`b${SUPABASE_PAGE_SIZE + 249}`);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, SUPABASE_PAGE_SIZE - 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE * 2 - 1);
  });

  it("returns an empty list when a page errors", async () => {
    const fetchPage = vi.fn(async () => ({
      data: null,
      error: { message: "boom" },
    }));
    const { data, error } = await fetchAllRows(fetchPage);
    expect(data).toEqual([]);
    expect(error?.message).toBe("boom");
  });
});
