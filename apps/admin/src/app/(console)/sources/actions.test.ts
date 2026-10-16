import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3100";
const SCOTIA_ID = "3f0e6f1c-2d4b-4c1a-9e8f-0a1b2c3d4e5f";
const SCOTIA = {
  id: SCOTIA_ID,
  issuer_name: "Scotiabank",
  compare_url: "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html",
  url_pattern: "/ca/en/personal/credit-cards/",
  schedule: "monthly",
  status: "active",
  robots_status: null,
  robots_checked_at: null,
  last_crawled_at: null,
  notes: null,
  created_at: "2026-10-12T00:00:00Z",
  updated_at: "2026-10-12T00:00:00Z",
};

type Write = { table: string; op: "insert" | "update"; payload: Record<string, unknown> };

const state = {
  origin: ORIGIN as string | null,
  user: { id: "u1", email: "info.praxisinnovations@gmail.com" } as { id: string; email: string } | null,
  role: "admin" as string | null,
  writes: [] as Write[],
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async () => ({ data: state.role, error: null })),
    from: (table: string) => {
      let op: "select" | Write["op"] = "select";
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        limit: () => builder,
        order: () => builder,
        insert: (payload: Record<string, unknown>) => {
          op = "insert";
          state.writes.push({ table, op, payload });
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          op = "update";
          state.writes.push({ table, op, payload });
          return builder;
        },
        maybeSingle: async () => ({ data: SCOTIA, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve(op === "select" ? { data: [], error: null } : { data: [{ id: SCOTIA_ID }], error: null }),
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

const { saveSource, setSourcePaused } = await import("./actions");

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const NEW_ISSUER = form({
  issuer_name: "Koho",
  compare_url: "https://www.koho.ca/credit-building/",
});

const ACTIONS = {
  "saveSource (create)": () => saveSource(null, NEW_ISSUER),
  "saveSource (update)": () =>
    saveSource(null, form({ id: SCOTIA_ID, issuer_name: "Scotiabank", compare_url: SCOTIA.compare_url })),
  "setSourcePaused (pause)": () => setSourcePaused(SCOTIA_ID, true),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_ORIGIN = ORIGIN;
  state.origin = ORIGIN;
  state.user = { id: "u1", email: "info.praxisinnovations@gmail.com" };
  state.role = "admin";
  state.writes = [];
});

describe.each(Object.entries(ACTIONS))("%s", (_name, run) => {
  it.each(["viewer", "validator"])("rejects the %s role without writing", async (role) => {
    state.role = role;
    const res = await run();
    expect(res).toMatchObject({ ok: false, message: "Your role can't make this change." });
    expect(state.writes).toEqual([]);
  });

  it("rejects a signed-in user who isn't on the allow-list", async () => {
    state.role = null;
    expect((await run()).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("rejects a request without a verified session", async () => {
    state.user = null;
    const res = await run();
    expect(res).toMatchObject({ ok: false, message: "Your session has ended. Sign in again." });
    expect(state.writes).toEqual([]);
  });

  it.each([["https://evil.example"], ["http://localhost:3101"], ["null"], [null]])(
    "rejects Origin %s before touching Supabase",
    async (origin) => {
      state.origin = origin;
      const res = await run();
      expect(res).toMatchObject({ ok: false, message: "This request did not come from the admin console." });
      expect(supabaseFactory).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    },
  );

  it("is allowed for an admin", async () => {
    const res = await run();
    expect(res.ok).toBe(true);
    expect(state.writes).toHaveLength(1);
  });
});

describe("admin writes", () => {
  it("creates a new issuer as active when it has a compare URL", async () => {
    await saveSource(null, NEW_ISSUER);
    expect(state.writes[0]).toEqual({
      table: "crawl_sources",
      op: "insert",
      payload: {
        issuer_name: "Koho",
        compare_url: "https://www.koho.ca/credit-building/",
        status: "active",
      },
    });
  });

  it("does not write when the URL is off the issuer's domain", async () => {
    const res = await saveSource(
      null,
      form({ issuer_name: "Scotiabank", compare_url: "https://www.ratehub.ca/credit-cards" }),
    );
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.fieldErrors?.compare_url).toMatch(/scotiabank\.com/);
    expect(state.writes).toEqual([]);
  });

  it("pauses an active issuer", async () => {
    await setSourcePaused(SCOTIA_ID, true);
    expect(state.writes).toEqual([{ table: "crawl_sources", op: "update", payload: { status: "paused" } }]);
  });

  it("rejects a malformed id", async () => {
    expect((await setSourcePaused("1 or 1=1", true)).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
});
