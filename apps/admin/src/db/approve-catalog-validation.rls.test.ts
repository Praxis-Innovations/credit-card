import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const RUN = "'00000000-0000-4000-8000-0000000000aa'";
const FIELDS = {
  fields: [{ key: "annual_fee", save: true, page_value: "120", value: "599" }],
};
const EARN_FIELDS = {
  fields: [{ key: "earn_rates[0].rate", save: true, page_value: "1", value: "2" }],
};

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into public.admin_users (email, role) values
      ('validator@example.com', 'validator'),
      ('viewer@example.com', 'viewer');
    insert into public.crawl_runs (id, source_id, source_scope, trigger, status, started_at)
      select '00000000-0000-4000-8000-0000000000aa', id, 'Scotiabank', 'cli', 'running', now()
      from public.crawl_sources where issuer_name = 'Scotiabank';
    insert into public.card_findings (run_id, source_id, product_url, card_name, extracted, diff_kind, linked_card_id)
      select '00000000-0000-4000-8000-0000000000aa', id,
        'https://www.scotiabank.com/ca/en/personal/credit-cards/american-express/gold-card.html',
        'Scotiabank Gold American Express Card', '{"annual_fee": {"value": 120, "quote": "$120"}}', 'changed',
        'scotia-gold-amex'
      from public.crawl_sources where issuer_name = 'Scotiabank';
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

function updateCardOp(annualFee: number) {
  return {
    op: "update",
    id: "scotia-gold-amex",
    set: {
      annual_fee: annualFee,
      last_verified: "2026-10-16",
      verified_at: "2026-10-16T12:00:00.000Z",
      status: "verified",
    },
  };
}

function rewardCategoriesOp(categories: unknown, extras: Record<string, unknown> = {}) {
  return {
    op: "update",
    id: "scotia-gold-amex",
    set: {
      ...extras,
      reward_categories: categories,
      last_verified: "2026-10-16",
      verified_at: "2026-10-16T12:00:00.000Z",
      status: "verified",
    },
  };
}

function approve(fields: unknown, cardOp: unknown) {
  return asRole(db, "authenticated", VALIDATOR, (tx) =>
    tx.query(
      `select public.approve_finding_to_catalog(
        (select id from public.card_findings where run_id = ${RUN} and review_status = 'pending'),
        $1::jsonb, $2::jsonb
      )`,
      [JSON.stringify(fields), JSON.stringify(cardOp)],
    ),
  );
}

describe("approve_finding_to_catalog validation", () => {
  it("rejects a p_card_op whose annual_fee diverges from review_fields", async () => {
    await expect(approve(FIELDS, updateCardOp(1))).rejects.toThrow(
      /card_op annual_fee does not match review_fields/,
    );
  });

  it("rejects unjustified reward_categories on update", async () => {
    await expect(
      approve(FIELDS, rewardCategoriesOp([{ category: "other", earnRate: 99 }], { annual_fee: 599 })),
    ).rejects.toThrow(/card_op\.set contains unjustified key reward_categories/);
  });

  it("rejects non-array reward_categories when earn rules are saved", async () => {
    await expect(approve(EARN_FIELDS, rewardCategoriesOp({ not: "an array" }))).rejects.toThrow(
      /reward_categories must be a json array/,
    );
  });

  it("rejects reward_categories with unknown category", async () => {
    await expect(
      approve(EARN_FIELDS, rewardCategoriesOp([{ category: "not_a_category", earnRate: 2 }])),
    ).rejects.toThrow(/unknown category/);
  });

  it("rejects reward_categories with out-of-bounds earnRate", async () => {
    await expect(
      approve(EARN_FIELDS, rewardCategoriesOp([{ category: "other", earnRate: 101 }])),
    ).rejects.toThrow(/earnRate out of bounds/);
  });

  it("returns null without mutating cards when the finding is no longer pending", async () => {
    const feeBefore = (
      await db.query<{ annual_fee: string }>(`select annual_fee::text from public.cards where id = 'scotia-gold-amex'`)
    ).rows[0]!.annual_fee;
    const rpc = await db.transaction(async (tx) => {
      await tx.query(
        `update public.card_findings set review_status = 'rejected', review_note = 'taken' where run_id = ${RUN}`,
      );
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      const { rows } = await tx.query<{ approve_finding_to_catalog: unknown }>(
        `select public.approve_finding_to_catalog(
          (select id from public.card_findings where run_id = ${RUN}),
          $1::jsonb, $2::jsonb
        ) as approve_finding_to_catalog`,
        [JSON.stringify(FIELDS), JSON.stringify(updateCardOp(1))],
      );
      await tx.rollback();
      return rows[0]!.approve_finding_to_catalog;
    });
    expect(rpc).toBeNull();
    const feeAfter = (
      await db.query<{ annual_fee: string }>(`select annual_fee::text from public.cards where id = 'scotia-gold-amex'`)
    ).rows[0]!.annual_fee;
    expect(feeAfter).toBe(feeBefore);
  });
});
