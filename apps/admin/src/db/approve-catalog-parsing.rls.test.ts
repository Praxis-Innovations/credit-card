import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb, jwtClaims } from "@/test/supabase-db";

const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const RUN = "'00000000-0000-4000-8000-0000000000ab'";
const VERIFIED = { last_verified: "2026-10-16", verified_at: "2026-10-16T12:00:00.000Z", status: "verified" };
const GOLD_FINDING = `select id from public.card_findings where run_id = ${RUN} and diff_kind = 'changed'`;
const NEW_FINDING = `select id from public.card_findings where card_name = 'Fee Comma Card'`;

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into public.admin_users (email, role) values ('validator@example.com', 'validator');
    insert into public.crawl_runs (id, source_id, source_scope, trigger, status, started_at)
      select ${RUN}, id, 'Scotiabank', 'cli', 'running', now()
      from public.crawl_sources where issuer_name = 'Scotiabank';
    insert into public.card_findings (run_id, source_id, product_url, card_name, extracted, diff_kind, linked_card_id)
      select ${RUN}, id, 'https://www.scotiabank.com/ca/en/personal/credit-cards/gold.html',
        'Scotiabank Gold American Express Card', '{}'::jsonb, 'changed', 'scotia-gold-amex'
      from public.crawl_sources where issuer_name = 'Scotiabank';
    insert into public.card_findings (run_id, source_id, product_url, card_name, extracted, diff_kind)
      select ${RUN}, id, 'https://www.scotiabank.com/ca/en/personal/credit-cards/fee-comma.html',
        'Fee Comma Card', '{}'::jsonb, 'new'
      from public.crawl_sources where issuer_name = 'Scotiabank';
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

function saved(key: string, value: string) {
  return { fields: [{ key, save: true, page_value: "", value }] };
}

/** Approve inside a rolled-back transaction; returns `readSql` evaluated afterwards. */
async function approveAndRead(findingSql: string, fields: unknown, cardOp: unknown, readSql: string) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
    await tx.exec("set local role authenticated");
    await tx.query(`select public.approve_finding_to_catalog((${findingSql}), $1::jsonb, $2::jsonb)`, [
      JSON.stringify(fields),
      JSON.stringify(cardOp),
    ]);
    await tx.exec("reset role");
    const { rows } = await tx.query<{ v: string | null }>(`select (${readSql}) as v`);
    await tx.rollback();
    return rows[0]?.v;
  });
}

const GOLD_FEE = "select annual_fee::text from public.cards where id = 'scotia-gold-amex'";

describe("approve_finding_to_catalog number parsing", () => {
  it("accepts a comma-formatted annual fee on update", async () => {
    const fee = await approveAndRead(
      GOLD_FINDING,
      saved("annual_fee", "1,200"),
      { op: "update", id: "scotia-gold-amex", set: { annual_fee: 1200, ...VERIFIED } },
      GOLD_FEE,
    );
    expect(fee).toBe("1200");
  });

  it("accepts a comma-formatted annual fee on insert", async () => {
    const fee = await approveAndRead(
      NEW_FINDING,
      saved("annual_fee", "1,200"),
      {
        op: "insert",
        row: {
          id: "scotiabank-fee-comma-card",
          name: "Fee Comma Card",
          issuer: "Scotiabank",
          annual_fee: 1200,
          point_currency: "cashback",
          reward_categories: [{ category: "other", earnRate: 1 }],
          welcome_offer: null,
          network: null,
          ...VERIFIED,
        },
      },
      "select annual_fee::text from public.cards where id = 'scotiabank-fee-comma-card'",
    );
    expect(fee).toBe("1200");
  });

  it("rejects a saved annual fee of none, as the admin app does", async () => {
    await expect(
      approveAndRead(
        GOLD_FINDING,
        saved("annual_fee", "none"),
        { op: "update", id: "scotia-gold-amex", set: { annual_fee: 0, ...VERIFIED } },
        GOLD_FEE,
      ),
    ).rejects.toThrow(/card_op annual_fee does not match review_fields/);
  });

  it("accepts comma-formatted welcome-bonus points", async () => {
    const points = await approveAndRead(
      GOLD_FINDING,
      saved("welcome_bonus.points", "50,000"),
      {
        op: "update",
        id: "scotia-gold-amex",
        set: {
          welcome_offer: { summary: "50000 Scene+ points after spend", estimatedValueCad: 400, points: 50000 },
          ...VERIFIED,
        },
      },
      "select welcome_offer->>'points' from public.cards where id = 'scotia-gold-amex'",
    );
    expect(points).toBe("50000");
  });
});
