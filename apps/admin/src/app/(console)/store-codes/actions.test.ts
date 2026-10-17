import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3100";
const BRAND = { id: "costco", name: "Costco" };
const CARD = { id: "scotia-gold-amex", name: "Scotia Gold Amex", network: "Amex" };

type Write = { table: string; op: "insert" | "update"; payload: Record<string, unknown> };

const state = {
  origin: ORIGIN as string | null,
  user: { id: "u1", email: "info.praxisinnovations@gmail.com" } as { id: string; email: string } | null,
  role: "admin" as string | null,
  brand: BRAND as { id: string; name: string } | null,
  card: CARD as { id: string; name: string; network: string | null } | null,
  writes: [] as Write[],
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async (name: string) => {
      if (name === "current_admin_role") return { data: state.role, error: null };
      return { data: null, error: null };
    }),
    from: (table: string) => {
      let op: "select" | Write["op"] = "select";
      let payload: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === "merchant_brands") return { data: state.brand, error: null };
          if (table === "cards") return { data: state.card, error: null };
          if (table === "merchant_code_findings") return { data: null, error: null };
          return { data: null, error: null };
        },
        insert: (row: Record<string, unknown>) => {
          op = "insert";
          payload = row;
          state.writes.push({ table, op, payload });
          return builder;
        },
        update: (row: Record<string, unknown>) => {
          op = "update";
          payload = row;
          state.writes.push({ table, op, payload });
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(op === "select" ? { data: null, error: null } : { data: [{ id: "f1" }], error: null }),
      };
      return builder;
    },
  };
}

const supabaseFactory = vi.fn(async () => fakeSupabase());

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.origin ? { origin: state.origin } : {}),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => supabaseFactory() }));

const { addTestPurchaseFinding } = await import("./actions");

const baseInput = {
  brandId: "costco",
  brandName: "Costco",
  cardId: "scotia-gold-amex",
  date: "2026-10-15",
  statementText: "COSTCO WHOLESALE #123",
  mccShown: "5411",
  categoryShown: "",
};

describe("addTestPurchaseFinding", () => {
  beforeEach(() => {
    process.env.ADMIN_ORIGIN = ORIGIN;
    state.origin = ORIGIN;
    state.user = { id: "u1", email: "info.praxisinnovations@gmail.com" };
    state.role = "admin";
    state.brand = { ...BRAND };
    state.card = { ...CARD };
    state.writes = [];
    supabaseFactory.mockClear();
  });

  it("binds chain and merchant_brand_id from the DB brand row", async () => {
    const res = await addTestPurchaseFinding(baseInput);
    expect(res).toEqual({
      ok: true,
      message: "Added to the review queue. Nothing changes for users until it is approved.",
    });
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      table: "merchant_code_findings",
      op: "insert",
      payload: {
        kind: "test_purchase",
        proposed: {
          chain: "Costco",
          merchant_brand_id: "costco",
          card_id: "scotia-gold-amex",
          mcc_shown: "5411",
        },
      },
    });
  });

  it("rejects an unknown brand id", async () => {
    state.brand = null;
    const res = await addTestPurchaseFinding({ ...baseInput, brandId: "no-such-brand" });
    expect(res).toEqual({ ok: false, message: "That store brand is not in the catalog." });
    expect(state.writes).toHaveLength(0);
  });

  it("rejects a brandName that does not match the catalog row", async () => {
    const res = await addTestPurchaseFinding({ ...baseInput, brandName: "Wrong Chain" });
    expect(res).toEqual({ ok: false, message: "Store brand name does not match the catalog." });
    expect(state.writes).toHaveLength(0);
  });

  it("ignores a forged brandName when empty and still uses the DB name", async () => {
    const res = await addTestPurchaseFinding({ ...baseInput, brandName: "  " });
    expect(res.ok).toBe(true);
    expect(state.writes[0]?.payload.proposed).toMatchObject({
      chain: "Costco",
      merchant_brand_id: "costco",
    });
  });
});
