import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyApprovedFindingToCatalog } from "./apply-to-catalog";

const FINDING_ID = "7a1c2e3d-4b5f-4a6b-8c7d-9e0f1a2b3c4d";

type RpcCall = { name: string; args: Record<string, unknown> };

const state = {
  cards: [] as Array<Record<string, unknown>>,
  rpc: null as { data: unknown; error: { message: string } | null } | null,
  calls: [] as RpcCall[],
};

function fakeSupabase() {
  return {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      return {
        select: () => ({
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return {
              maybeSingle: async () => {
                const row = state.cards.find((c) => filters.every(([k, v]) => c[k] === v)) ?? null;
                return { data: row, error: null };
              },
            };
          },
          like: async (_column: string, pattern: string) => {
            const prefix = String(pattern).replace(/%/g, "");
            return {
              data: state.cards.filter((c) => String(c.id).startsWith(prefix)).map((c) => ({ id: c.id })),
              error: null,
            };
          },
        }),
      };
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.calls.push({ name, args });
      return state.rpc ?? { data: { id: FINDING_ID, card_name: "Gold", linked_card_id: "scotia-gold-amex" }, error: null };
    },
  };
}

beforeEach(() => {
  state.cards = [
    {
      id: "scotia-gold-amex",
      name: "Gold American Express",
      issuer: "Scotiabank",
      annual_fee: 120,
      point_currency: "Scene+",
      reward_categories: [{ category: "other", earnRate: 1 }],
      welcome_offer: null,
      network: "Amex",
    },
  ];
  state.rpc = null;
  state.calls = [];
});

describe("applyApprovedFindingToCatalog", () => {
  it("loads the linked card, builds an update, and calls the approve RPC", async () => {
    const res = await applyApprovedFindingToCatalog(fakeSupabase() as never, {
      findingId: FINDING_ID,
      linkedCardId: "scotia-gold-amex",
      diffKind: "changed",
      cardName: "Gold American Express",
      issuerName: "Scotiabank",
      fields: { fields: [{ key: "annual_fee", save: true, page_value: "120", value: "599" }] },
    });
    expect(res).toEqual({ ok: true, cardName: "Gold", linkedCardId: "scotia-gold-amex" });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]!.name).toBe("approve_finding_to_catalog");
    expect(state.calls[0]!.args.p_finding_id).toBe(FINDING_ID);
    expect(state.calls[0]!.args.p_card_op).toMatchObject({
      op: "update",
      id: "scotia-gold-amex",
      set: { annual_fee: 599, status: "verified" },
    });
  });

  it("inserts a new card op for new findings", async () => {
    const res = await applyApprovedFindingToCatalog(fakeSupabase() as never, {
      findingId: FINDING_ID,
      linkedCardId: null,
      diffKind: "new",
      cardName: "E2E Approve Card",
      issuerName: "Scotiabank",
      fields: {
        fields: [
          { key: "name", save: true, page_value: "E2E Approve Card", value: "E2E Approve Card" },
          { key: "annual_fee", save: true, page_value: "120", value: "120" },
        ],
      },
      extracted: { reward_currency: { value: "Scene+ points", quote: "Scene+" } },
    });
    expect(res.ok).toBe(true);
    expect(state.calls[0]!.args.p_card_op).toMatchObject({
      op: "insert",
      row: {
        id: "scotiabank-e2e-approve-card",
        name: "E2E Approve Card",
        issuer: "Scotiabank",
        annual_fee: 120,
        point_currency: "Scene+",
        status: "verified",
      },
    });
  });

  it("skips a card op for possibly discontinued findings but still approves", async () => {
    const res = await applyApprovedFindingToCatalog(fakeSupabase() as never, {
      findingId: FINDING_ID,
      linkedCardId: "scotia-gold-amex",
      diffKind: "possibly_discontinued",
      cardName: "Gold",
      issuerName: "Scotiabank",
      fields: { fields: [] },
    });
    expect(res.ok).toBe(true);
    expect(state.calls[0]!.args.p_card_op).toBeNull();
  });

  it("surfaces RPC failures without claiming success", async () => {
    state.rpc = { data: null, error: { message: "Could not update" } };
    const res = await applyApprovedFindingToCatalog(fakeSupabase() as never, {
      findingId: FINDING_ID,
      linkedCardId: null,
      diffKind: "new",
      cardName: "X",
      issuerName: "Scotiabank",
      fields: { fields: [{ key: "name", save: true, page_value: "X", value: "X" }] },
    });
    expect(res).toEqual({ ok: false, message: "Could not update the catalog. Refresh and try again." });
  });
});
