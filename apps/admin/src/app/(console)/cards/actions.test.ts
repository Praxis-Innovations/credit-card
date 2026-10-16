import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3100";

const state = {
  origin: ORIGIN as string | null,
  user: { id: "u1", email: "info.praxisinnovations@gmail.com" } as { id: string; email: string } | null,
  role: "admin" as string | null,
  rpcResult: { id: "scotia-gold-amex", status: "rejected" } as Record<string, unknown> | null,
  rpcError: null as { message: string } | null,
  lastRpc: null as { name: string; args: Record<string, unknown> } | null,
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "current_admin_role") return { data: state.role, error: null };
      state.lastRpc = { name, args };
      return { data: state.rpcResult, error: state.rpcError };
    }),
  };
}

const supabaseFactory = vi.fn(async () => fakeSupabase());

vi.mock("next/headers", () => ({
  headers: async () => new Headers(state.origin ? { origin: state.origin } : {}),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => supabaseFactory() }));

const { retireCard } = await import("./actions");

describe("retireCard", () => {
  beforeEach(() => {
    process.env.ADMIN_ORIGIN = ORIGIN;
    state.origin = ORIGIN;
    state.user = { id: "u1", email: "info.praxisinnovations@gmail.com" };
    state.role = "admin";
    state.rpcResult = { id: "scotia-gold-amex", status: "rejected" };
    state.rpcError = null;
    state.lastRpc = null;
    supabaseFactory.mockClear();
  });

  it("calls retire_card for an admin", async () => {
    const res = await retireCard("scotia-gold-amex");
    expect(res).toEqual({
      ok: true,
      message: "Card retired. It is no longer served by the API.",
    });
    expect(state.lastRpc).toEqual({
      name: "retire_card",
      args: { p_card_id: "scotia-gold-amex" },
    });
  });

  it("rejects a viewer", async () => {
    state.role = "viewer";
    const res = await retireCard("scotia-gold-amex");
    expect(res.ok).toBe(false);
    expect(state.lastRpc).toBeNull();
  });

  it("reports a missing card", async () => {
    state.rpcResult = null;
    const res = await retireCard("missing-card");
    expect(res).toEqual({ ok: false, message: "That card no longer exists." });
  });
});
