import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const VIEWER = jwtClaims({ email: "viewer@example.com" });
const RUN = "'00000000-0000-4000-8000-0000000000aa'";
const FIELDS = {
  fields: [{ key: "annual_fee", save: true, page_value: "120", value: "599" }],
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

async function affected(tx: Transaction, sql: string): Promise<number> {
  const res = await tx.query(sql);
  return res.affectedRows ?? 0;
}

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

const NEW_CARD_ROW = {
  id: "scotiabank-brand-new-scotia-card",
  name: "Brand New Scotia Card",
  issuer: "Scotiabank",
  annual_fee: 99,
  point_currency: "Scene+",
  reward_categories: [{ category: "other", earnRate: 1 }],
  welcome_offer: null,
  network: null,
  last_verified: "2026-10-16",
  verified_at: "2026-10-16T12:00:00.000Z",
  status: "verified",
};

const NEW_REVIEW_FIELDS = {
  fields: [
    { key: "name", save: true, page_value: "Brand New Scotia Card", value: "Brand New Scotia Card" },
    { key: "annual_fee", save: true, page_value: "99", value: "99" },
  ],
};

describe("approve_finding_to_catalog auth", () => {
  it("denies a viewer", async () => {
    await expect(
      asRole(db, "authenticated", VIEWER, (tx) =>
        tx.query(
          `select public.approve_finding_to_catalog(
            (select id from public.card_findings where run_id = ${RUN}),
            $1::jsonb, null
          )`,
          [JSON.stringify(FIELDS)],
        ),
      ),
    ).rejects.toThrow(/not authorized/);
  });

  it("does not let a validator write cards outside the RPC", async () => {
    const n = await asRole(db, "authenticated", VALIDATOR, (tx) =>
      affected(tx, `update public.cards set annual_fee = 1 where id = 'scotia-gold-amex'`),
    );
    expect(n).toBe(0);
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(
          `insert into public.cards (
             id, name, issuer, annual_fee, point_currency, reward_categories, last_verified, status
           ) values (
             'validator-forged', 'Forged', 'Scotiabank', 0, 'cashback',
             '[{"category":"other","earnRate":1}]'::jsonb, current_date, 'verified'
           )`,
        ),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});

describe("approve_finding_to_catalog card audit", () => {
  it("records applied card values when approving a changed finding", async () => {
    const out = await db.transaction(async (tx) => {
      const { rows: beforeRows } = await tx.query<{ annual_fee: string; name: string }>(
        `select annual_fee::text, name from public.cards where id = 'scotia-gold-amex'`,
      );
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      await tx.query(
        `select public.approve_finding_to_catalog(
          (select id from public.card_findings where run_id = ${RUN} and review_status = 'pending'),
          $1::jsonb, $2::jsonb
        )`,
        [JSON.stringify(FIELDS), JSON.stringify(updateCardOp(599))],
      );
      await tx.exec("reset role");
      const { rows: findings } = await tx.query<{ id: string }>(
        `select id::text from public.card_findings where run_id = ${RUN}`,
      );
      const { rows: cardAudit } = await tx.query<{
        actor_email: string;
        action: string;
        entity: string;
        entity_id: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
      }>(
        `select actor_email, action, entity, entity_id, before, after
         from public.admin_audit where entity = 'cards' order by id desc limit 1`,
      );
      await tx.rollback();
      return { cardAudit, findingId: findings[0]!.id, before: beforeRows[0]! };
    });

    expect(out.cardAudit[0]).toMatchObject({
      actor_email: "validator@example.com",
      action: "card.approve_update",
      entity: "cards",
      entity_id: "scotia-gold-amex",
      before: { id: "scotia-gold-amex", name: out.before.name, annual_fee: Number(out.before.annual_fee) },
      after: {
        op: "update",
        finding_id: out.findingId,
        review_fields: FIELDS,
        set: { annual_fee: 599, status: "verified" },
        row: { id: "scotia-gold-amex", annual_fee: 599, status: "verified" },
      },
    });
  });
});

describe("approve_finding_to_catalog update", () => {
  it("updates the linked card and audits the finding decision", async () => {
    const out = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      const { rows: rpcRows } = await tx.query<{ approve_finding_to_catalog: Record<string, unknown> }>(
        `select public.approve_finding_to_catalog(
          (select id from public.card_findings where run_id = ${RUN} and review_status = 'pending'),
          $1::jsonb, $2::jsonb
        ) as approve_finding_to_catalog`,
        [JSON.stringify(FIELDS), JSON.stringify(updateCardOp(599))],
      );
      await tx.exec("reset role");
      const { rows: cards } = await tx.query<{ annual_fee: string }>(
        `select annual_fee::text from public.cards where id = 'scotia-gold-amex'`,
      );
      const { rows: findings } = await tx.query<{
        review_status: string;
        review_fields: unknown;
        reviewed_by: string;
      }>(`select review_status, review_fields, reviewed_by from public.card_findings where run_id = ${RUN}`);
      const { rows: audit } = await tx.query<{ action: string; after: Record<string, unknown> }>(
        `select action, after from public.admin_audit where entity = 'card_findings' order by id desc limit 1`,
      );
      await tx.rollback();
      return { rpc: rpcRows[0]!.approve_finding_to_catalog, cards, findings, audit };
    });

    expect(out.rpc).toMatchObject({ linked_card_id: "scotia-gold-amex" });
    expect(out.cards[0]!.annual_fee).toBe("599");
    expect(out.findings[0]).toMatchObject({
      review_status: "approved",
      reviewed_by: "validator@example.com",
      review_fields: FIELDS,
    });
    expect(out.audit[0]).toMatchObject({
      action: "finding.approve",
      after: { review_status: "approved", linked_card_id: "scotia-gold-amex" },
    });
  });
});

describe("approve_finding_to_catalog validation", () => {
  it("rejects non-array reward_categories on update", async () => {
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(
          `select public.approve_finding_to_catalog(
            (select id from public.card_findings where run_id = ${RUN} and review_status = 'pending'),
            $1::jsonb, $2::jsonb
          )`,
          [
            JSON.stringify(FIELDS),
            JSON.stringify({
              op: "update",
              id: "scotia-gold-amex",
              set: {
                reward_categories: { not: "an array" },
                last_verified: "2026-10-16",
                verified_at: "2026-10-16T12:00:00.000Z",
                status: "verified",
              },
            }),
          ],
        ),
      ),
    ).rejects.toThrow(/reward_categories must be a json array/);
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

describe("approve_finding_to_catalog insert", () => {
  it("inserts a new verified card, links it, and audits the applied row", async () => {
    const out = await db.transaction(async (tx) => {
      await tx.query(
        `insert into public.card_findings (run_id, source_id, product_url, card_name, extracted, diff_kind)
         select ${RUN}, id,
           'https://www.scotiabank.com/ca/en/personal/credit-cards/new-card.html',
           'Brand New Scotia Card', '{"annual_fee": {"value": 99, "quote": "$99"}}', 'new'
         from public.crawl_sources where issuer_name = 'Scotiabank'`,
      );
      const { rows: ids } = await tx.query<{ id: string }>(
        `select id::text from public.card_findings where card_name = 'Brand New Scotia Card'`,
      );
      const findingId = ids[0]!.id;
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      await tx.query(`select public.approve_finding_to_catalog($1::uuid, $2::jsonb, $3::jsonb)`, [
        findingId,
        JSON.stringify(NEW_REVIEW_FIELDS),
        JSON.stringify({ op: "insert", row: NEW_CARD_ROW }),
      ]);
      await tx.exec("reset role");
      const { rows: cards } = await tx.query<{ id: string; status: string; annual_fee: string }>(
        `select id, status::text, annual_fee::text from public.cards where id = 'scotiabank-brand-new-scotia-card'`,
      );
      const { rows: findings } = await tx.query<{ review_status: string; linked_card_id: string }>(
        `select review_status, linked_card_id from public.card_findings where id = $1::uuid`,
        [findingId],
      );
      const { rows: cardAudit } = await tx.query<{
        action: string;
        entity_id: string;
        before: unknown;
        after: Record<string, unknown>;
      }>(
        `select action, entity_id, before, after from public.admin_audit
         where entity = 'cards' and entity_id = 'scotiabank-brand-new-scotia-card'`,
      );
      await tx.rollback();
      return { cards, findings, cardAudit, findingId };
    });

    expect(out.cards).toEqual([
      { id: "scotiabank-brand-new-scotia-card", status: "verified", annual_fee: "99" },
    ]);
    expect(out.findings[0]).toEqual({
      review_status: "approved",
      linked_card_id: "scotiabank-brand-new-scotia-card",
    });
    expect(out.cardAudit[0]).toMatchObject({
      action: "card.approve_insert",
      entity_id: "scotiabank-brand-new-scotia-card",
      before: null,
      after: {
        op: "insert",
        finding_id: out.findingId,
        review_fields: NEW_REVIEW_FIELDS,
        row: { id: "scotiabank-brand-new-scotia-card", annual_fee: 99, status: "verified" },
      },
    });
  });
});
