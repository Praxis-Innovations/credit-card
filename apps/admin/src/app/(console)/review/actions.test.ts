import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3100";
const FINDING_ID = "7a1c2e3d-4b5f-4a6b-8c7d-9e0f1a2b3c4d";
const EMAIL = "validator@example.com";

type Write = {
  table: string;
  op: "update" | "insert" | "delete";
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const state = {
  origin: ORIGIN as string | null,
  user: { id: "u1", email: EMAIL } as { id: string; email: string } | null,
  role: "validator" as string | null,
  /** Rows the conditional update matches; [] simulates a finding that is no longer pending. */
  matched: [{ id: FINDING_ID, card_name: "Scotiabank Gold American Express Card" }] as Array<Record<string, unknown>>,
  dbError: null as { code: string } | null,
  writes: [] as Write[],
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async () => ({ data: state.role, error: null })),
    from: (table: string) => {
      const write: Write = { table, op: "update", payload: {}, filters: [] };
      const builder = {
        update: (payload: Record<string, unknown>) => {
          write.payload = payload;
          state.writes.push(write);
          return builder;
        },
        eq: (column: string, value: unknown) => {
          write.filters.push([column, value]);
          return builder;
        },
        select: () => builder,
        then: (resolve: (v: unknown) => unknown) =>
          resolve(state.dbError ? { data: null, error: state.dbError } : { data: state.matched, error: null }),
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

const { approveFinding, rejectFinding } = await import("./actions");

const ACTIONS = {
  approveFinding: () => approveFinding(FINDING_ID),
  rejectFinding: () => rejectFinding(FINDING_ID, "Fee quote is from last year's page."),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_ORIGIN = ORIGIN;
  state.origin = ORIGIN;
  state.user = { id: "u1", email: EMAIL };
  state.role = "validator";
  state.matched = [{ id: FINDING_ID, card_name: "Scotiabank Gold American Express Card" }];
  state.dbError = null;
  state.writes = [];
});

describe.each(Object.entries(ACTIONS))("%s", (_name, run) => {
  it("rejects the viewer role without writing", async () => {
    state.role = "viewer";
    expect(await run()).toMatchObject({ ok: false, message: "Your role can't make this change." });
    expect(state.writes).toEqual([]);
  });

  it("rejects a signed-in user who isn't on the allow-list", async () => {
    state.role = null;
    expect((await run()).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("rejects a request without a verified session", async () => {
    state.user = null;
    expect(await run()).toMatchObject({ ok: false, message: "Your session has ended. Sign in again." });
    expect(state.writes).toEqual([]);
  });

  it.each([["https://evil.example"], ["http://localhost:3101"], ["null"], [null]])(
    "rejects Origin %s before touching Supabase",
    async (origin) => {
      state.origin = origin;
      expect(await run()).toMatchObject({ ok: false, message: "This request did not come from the admin console." });
      expect(supabaseFactory).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    },
  );

  it("reports a finding that was already reviewed, without claiming success", async () => {
    state.matched = [];
    expect(await run()).toMatchObject({
      ok: false,
      message: "That finding was already reviewed or no longer exists. Refresh the queue.",
    });
  });

  it("reports a database error", async () => {
    state.dbError = { code: "42501" };
    expect(await run()).toMatchObject({ ok: false });
  });

  it("is allowed for an admin", async () => {
    state.role = "admin";
    expect((await run()).ok).toBe(true);
    expect(state.writes).toHaveLength(1);
  });
});

describe("approveFinding", () => {
  it("records the decision with a conditional update on pending, and touches only card_findings", async () => {
    const res = await approveFinding(FINDING_ID);
    expect(res).toEqual({ ok: true, message: "Approved Scotiabank Gold American Express Card." });
    expect(state.writes).toHaveLength(1);
    const [write] = state.writes;
    expect(write!.table).toBe("card_findings");
    expect(write!.payload).toMatchObject({ review_status: "approved", review_note: null, reviewed_by: EMAIL });
    expect(typeof write!.payload.reviewed_at).toBe("string");
    expect(write!.filters).toEqual([
      ["id", FINDING_ID],
      ["review_status", "pending"],
    ]);
  });

  it.each(["1 or 1=1", "", "not-a-uuid"])("rejects malformed id %j without writing", async (id) => {
    expect((await approveFinding(id)).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

describe("rejectFinding", () => {
  it.each([[""], ["   "], [undefined as unknown as string]])("requires a reason (%j)", async (reason) => {
    expect(await rejectFinding(FINDING_ID, reason)).toEqual({ ok: false, message: "Give a reason for rejecting." });
    expect(state.writes).toEqual([]);
  });

  it("rejects an over-long reason", async () => {
    const res = await rejectFinding(FINDING_ID, "x".repeat(1001));
    expect(res.ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("stores the trimmed reason and the reviewer, conditional on pending", async () => {
    const res = await rejectFinding(FINDING_ID, "  Quote is from the footnotes.  ");
    expect(res).toEqual({ ok: true, message: "Rejected Scotiabank Gold American Express Card." });
    const [write] = state.writes;
    expect(write!.payload).toMatchObject({
      review_status: "rejected",
      review_note: "Quote is from the footnotes.",
      reviewed_by: EMAIL,
    });
    expect(write!.filters).toContainEqual(["review_status", "pending"]);
  });
});
