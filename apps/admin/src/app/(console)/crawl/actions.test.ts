import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_ACTIVE_SCOPE } from "@/lib/crawl/types";

const ORIGIN = "http://localhost:3100";
const SCOTIA_ID = "3f0e6f1c-2d4b-4c1a-9e8f-0a1b2c3d4e5f";
const RUN_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const EMAIL = "info.praxisinnovations@gmail.com";

const SCOTIA = {
  id: SCOTIA_ID,
  issuer_name: "Scotiabank",
  compare_url: "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html",
  status: "active",
};

type Write = {
  table: string;
  op: "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
};

const state = {
  origin: ORIGIN as string | null,
  user: { id: "u1", email: EMAIL } as { id: string; email: string } | null,
  role: "admin" as string | null,
  writes: [] as Write[],
  queueBlocked: false,
  sources: [SCOTIA] as typeof SCOTIA[],
  run: {
    id: RUN_ID,
    source_id: SCOTIA_ID,
    source_scope: "Scotiabank",
    status: "requested",
  },
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async () => ({ data: state.role, error: null })),
    from: (table: string) => {
      let op: "select" | Write["op"] = "select";
      let payload: Record<string, unknown> | undefined;
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, value: unknown) => {
          filters[col] = value;
          return builder;
        },
        in: () => builder,
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        returns: () => builder,
        insert: (row: Record<string, unknown>) => {
          op = "insert";
          payload = row;
          state.writes.push({ table, op, payload: row });
          return builder;
        },
        update: (row: Record<string, unknown>) => {
          op = "update";
          payload = row;
          state.writes.push({ table, op, payload: row });
          return builder;
        },
        delete: () => {
          op = "delete";
          state.writes.push({ table, op });
          return builder;
        },
        maybeSingle: async () => {
          if (table === "crawl_sources") return { data: SCOTIA, error: null };
          if (table === "crawl_runs") return { data: state.run, error: null };
          return { data: null, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (op === "select") {
            if (table === "crawl_runs") {
              return resolve({ data: state.queueBlocked ? [{ id: RUN_ID }] : [], error: null });
            }
            if (table === "crawl_sources") {
              return resolve({ data: state.sources, error: null });
            }
            return resolve({ data: [], error: null });
          }
          return resolve({ data: [{ id: filters.id ?? RUN_ID ?? SCOTIA_ID }], error: null, payload });
        },
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

const { requestCrawl, cancelCrawlRequest, retryCrawl } = await import("./actions");

const ACTIONS = {
  requestCrawl: () => requestCrawl(SCOTIA_ID),
  cancelCrawlRequest: () => cancelCrawlRequest(RUN_ID),
  retryCrawl: () => {
    state.run = { ...state.run, status: "failed" };
    return retryCrawl(RUN_ID);
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_ORIGIN = ORIGIN;
  state.origin = ORIGIN;
  state.user = { id: "u1", email: EMAIL };
  state.role = "admin";
  state.writes = [];
  state.queueBlocked = false;
  state.sources = [SCOTIA];
  state.run = {
    id: RUN_ID,
    source_id: SCOTIA_ID,
    source_scope: "Scotiabank",
    status: "requested",
  };
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

  it.each([["https://evil.example"], ["http://localhost:3101"], [null]])(
    "rejects Origin %s before touching Supabase",
    async (origin) => {
      state.origin = origin;
      const res = await run();
      expect(res).toMatchObject({ ok: false, message: "This request did not come from the admin console." });
      expect(supabaseFactory).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    },
  );
});

describe("requestCrawl", () => {
  it("inserts a requested crawl_runs row for one issuer", async () => {
    const res = await requestCrawl(SCOTIA_ID);
    expect(res.ok).toBe(true);
    expect(state.writes).toEqual([
      {
        table: "crawl_runs",
        op: "insert",
        payload: {
          source_id: SCOTIA_ID,
          source_scope: "Scotiabank",
          trigger: "manual",
          status: "requested",
          requested_by: EMAIL,
        },
      },
    ]);
  });

  it("queues every active issuer", async () => {
    const res = await requestCrawl(ALL_ACTIVE_SCOPE);
    expect(res.ok).toBe(true);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]?.payload).toMatchObject({ source_scope: "Scotiabank", status: "requested" });
  });

  it("refuses when a crawl is already queued", async () => {
    state.queueBlocked = true;
    const res = await requestCrawl(SCOTIA_ID);
    expect(res.ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

describe("cancelCrawlRequest", () => {
  it("deletes a requested run", async () => {
    const res = await cancelCrawlRequest(RUN_ID);
    expect(res.ok).toBe(true);
    expect(state.writes).toEqual([{ table: "crawl_runs", op: "delete" }]);
  });

  it("refuses to cancel a running crawl", async () => {
    state.run = { ...state.run, status: "running" };
    const res = await cancelCrawlRequest(RUN_ID);
    expect(res.ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

describe("retryCrawl", () => {
  it("queues a new requested run from a failed crawl", async () => {
    state.run = { ...state.run, status: "failed" };
    const res = await retryCrawl(RUN_ID);
    expect(res.ok).toBe(true);
    expect(state.writes[0]).toMatchObject({
      table: "crawl_runs",
      op: "insert",
      payload: { source_id: SCOTIA_ID, status: "requested", requested_by: EMAIL },
    });
  });
});
