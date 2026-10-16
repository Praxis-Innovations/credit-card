import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "http://localhost:3100";
const FINDING_ID = "7a1c2e3d-4b5f-4a6b-8c7d-9e0f1a2b3c4d";
const EMAIL = "validator@example.com";

const FIELDS = {
  fields: [{ key: "annual_fee", save: true, page_value: "59", value: "599" }],
};

const { applyApprovedFindingToCatalog } = vi.hoisted(() => ({
  applyApprovedFindingToCatalog: vi.fn(
    async (): Promise<
      | { ok: true; cardName: string | null; linkedCardId: string | null }
      | { ok: false; message: string }
    > => ({ ok: true, cardName: "Scotiabank Gold American Express Card", linkedCardId: null }),
  ),
}));
vi.mock("@/lib/review/apply-to-catalog", () => ({ applyApprovedFindingToCatalog }));

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
  pendingFinding: {
    id: FINDING_ID,
    card_name: "Scotiabank Gold American Express Card",
    extracted: { annual_fee: { value: 59, quote: "$59" } },
    check_results: null,
    diff: { kind: "new", linked_card_id: null, match: null, changes: [] },
    diff_kind: "new",
    linked_card_id: null,
    review_status: "pending",
    source: { issuer_name: "Scotiabank" },
  } as Record<string, unknown> | null,
  nextIds: [] as Array<{ id: string }>,
  dbError: null as { code: string } | null,
  writes: [] as Write[],
};

function fakeSupabase() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async () => ({ data: state.role, error: null })),
    from: (table: string) => {
      const write: Write = { table, op: "update", payload: {}, filters: [] };
      let mode: "update" | "select" = "select";
      const builder = {
        update: (payload: Record<string, unknown>) => {
          mode = "update";
          write.op = "update";
          write.payload = payload;
          state.writes.push(write);
          return builder;
        },
        select: () => builder,
        eq: (column: string, value: unknown) => {
          write.filters.push([column, value]);
          return builder;
        },
        in: () => builder,
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () =>
          Promise.resolve(
            state.dbError && mode === "select"
              ? { data: null, error: state.dbError }
              : { data: state.pendingFinding, error: null },
          ),
        then: (resolve: (v: unknown) => unknown) => {
          if (mode === "update") {
            return resolve(
              state.dbError ? { data: null, error: state.dbError } : { data: state.matched, error: null },
            );
          }
          return resolve({ data: state.nextIds, error: null });
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

const { approveFinding, rejectFinding } = await import("./actions");

const ACTIONS = {
  approveFinding: () => approveFinding(FINDING_ID, FIELDS),
  rejectFinding: () => rejectFinding(FINDING_ID, "Fee quote is from last year's page."),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_ORIGIN = ORIGIN;
  state.origin = ORIGIN;
  state.user = { id: "u1", email: EMAIL };
  state.role = "validator";
  state.matched = [{ id: FINDING_ID, card_name: "Scotiabank Gold American Express Card" }];
  state.pendingFinding = {
    id: FINDING_ID,
    card_name: "Scotiabank Gold American Express Card",
    extracted: { annual_fee: { value: 59, quote: "$59" } },
    check_results: null,
    diff: { kind: "new", linked_card_id: null, match: null, changes: [] },
    diff_kind: "new",
    linked_card_id: null,
    review_status: "pending",
    source: { issuer_name: "Scotiabank" },
  };
  state.nextIds = [];
  state.dbError = null;
  state.writes = [];
  applyApprovedFindingToCatalog.mockClear();
  applyApprovedFindingToCatalog.mockResolvedValue({
    ok: true,
    cardName: "Scotiabank Gold American Express Card",
    linkedCardId: null,
  });
});

describe.each(Object.entries(ACTIONS))("%s", (_name, run) => {
  it("rejects the viewer role without writing", async () => {
    state.role = "viewer";
    expect(await run()).toMatchObject({ ok: false, message: "Your role can't make this change." });
    expect(state.writes).toEqual([]);
    expect(applyApprovedFindingToCatalog).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who isn't on the allow-list", async () => {
    state.role = null;
    expect((await run()).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("rejects a verified session that has ended", async () => {
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
    state.pendingFinding = null;
    if (_name === "approveFinding") {
      // Approve loads the finding first; a missing pending row fails before apply.
      expect(await run()).toMatchObject({
        ok: false,
        message: "That finding was already reviewed or no longer exists. Refresh the queue.",
      });
      expect(applyApprovedFindingToCatalog).not.toHaveBeenCalled();
    } else {
      expect(await run()).toMatchObject({
        ok: false,
        message: "That finding was already reviewed or no longer exists. Refresh the queue.",
      });
    }
  });

  it("is allowed for an admin", async () => {
    state.role = "admin";
    expect((await run()).ok).toBe(true);
  });
});

describe("approveFinding", () => {
  it("applies accepted values via the atomic catalog RPC and does not update findings client-side", async () => {
    const res = await approveFinding(FINDING_ID, FIELDS);
    expect(res).toEqual({
      ok: true,
      message: "Approved Scotiabank Gold American Express Card.",
      nextId: null,
    });
    expect(applyApprovedFindingToCatalog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        findingId: FINDING_ID,
        diffKind: "new",
        cardName: "Scotiabank Gold American Express Card",
        issuerName: "Scotiabank",
        fields: FIELDS,
      }),
    );
    // Decision + catalog write happen inside the RPC — no direct card_findings update.
    expect(state.writes).toEqual([]);
  });

  it("does not claim success when the catalog write / approve RPC fails", async () => {
    applyApprovedFindingToCatalog.mockResolvedValueOnce({ ok: false, message: "Could not update the catalog." });
    expect(await approveFinding(FINDING_ID, FIELDS)).toEqual({
      ok: false,
      message: "Could not update the catalog.",
    });
    expect(state.writes).toEqual([]);
  });

  it("returns the next pending id for Approve and next", async () => {
    state.nextIds = [{ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }];
    const res = await approveFinding(FINDING_ID, FIELDS);
    expect(res).toMatchObject({ ok: true, nextId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
  });

  it("rejects missing or unknown field decisions without writing", async () => {
    expect((await approveFinding(FINDING_ID, { fields: [] })).ok).toBe(false);
    expect((await approveFinding(FINDING_ID, { fields: [{ key: "nope", save: true, page_value: "1", value: "1" }] })).ok).toBe(
      false,
    );
    expect(applyApprovedFindingToCatalog).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });

  it.each(["1 or 1=1", "", "not-a-uuid"])("rejects malformed id %j without writing", async (id) => {
    expect((await approveFinding(id, FIELDS)).ok).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

describe("approveFinding field normalization", () => {
  it("ignores a tampered page_value and records the finding's proposed value instead", async () => {
    const tampered = {
      fields: [{ key: "annual_fee", save: true, page_value: "599", value: "599" }],
    };
    const res = await approveFinding(FINDING_ID, tampered);
    expect(res.ok).toBe(true);
    const expected = {
      fields: [{ key: "annual_fee", save: true, page_value: "59", value: "599" }],
    };
    expect(applyApprovedFindingToCatalog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fields: expected }),
    );
  });

  it("resets value to page_value when Save is unticked so unsaved edits are not stored", async () => {
    state.pendingFinding = {
      ...state.pendingFinding!,
      extracted: {
        annual_fee: { value: 59, quote: "$59" },
        card_name: { value: "Gold", quote: "Gold" },
      },
    };
    const res = await approveFinding(FINDING_ID, {
      fields: [
        { key: "annual_fee", save: true, page_value: "59", value: "599" },
        { key: "name", save: false, page_value: "Gold", value: "Gold Amex" },
      ],
    });
    expect(res.ok).toBe(true);
    expect(applyApprovedFindingToCatalog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fields: {
          fields: [
            { key: "annual_fee", save: true, page_value: "59", value: "599" },
            { key: "name", save: false, page_value: "Gold", value: "Gold" },
          ],
        },
      }),
    );
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

  it("stores the trimmed reason and the reviewer, conditional on pending, without touching the catalog", async () => {
    const res = await rejectFinding(FINDING_ID, "  Quote is from the footnotes.  ");
    expect(res).toEqual({
      ok: true,
      message: "Rejected Scotiabank Gold American Express Card.",
      nextId: null,
    });
    expect(applyApprovedFindingToCatalog).not.toHaveBeenCalled();
    const [write] = state.writes;
    expect(write!.payload).toMatchObject({
      review_status: "rejected",
      review_note: "Quote is from the footnotes.",
      review_fields: null,
      reviewed_by: EMAIL,
    });
    expect(write!.filters).toContainEqual(["review_status", "pending"]);
  });
});
