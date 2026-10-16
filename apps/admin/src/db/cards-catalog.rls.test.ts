import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const ADMIN = jwtClaims({ email: "info.praxisinnovations@gmail.com" });
const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const VIEWER = jwtClaims({ email: "viewer@example.com" });

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into public.admin_users (email, role) values
      ('validator@example.com', 'validator'),
      ('viewer@example.com', 'viewer');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function cardStatus(tx: Transaction, id: string): Promise<string | null> {
  const { rows } = await tx.query<{ status: string }>(
    "select status::text as status from public.cards where id = $1",
    [id],
  );
  return rows[0]?.status ?? null;
}

describe("cards console RLS", () => {
  it("lets a viewer read non-verified cards that anon cannot", async () => {
    await db.exec(`
      update public.cards set status = 'pending' where id = 'scotia-gold-amex';
    `);

    await asRole(db, "anon", {}, async (tx) => {
      const { rows } = await tx.query(
        "select id from public.cards where id = 'scotia-gold-amex'",
      );
      expect(rows).toEqual([]);
    });

    await asRole(db, "authenticated", VIEWER, async (tx) => {
      const { rows } = await tx.query<{ id: string; status: string }>(
        "select id, status::text as status from public.cards where id = 'scotia-gold-amex'",
      );
      expect(rows).toEqual([{ id: "scotia-gold-amex", status: "pending" }]);
    });

    await db.exec(`
      update public.cards set status = 'verified' where id = 'scotia-gold-amex';
    `);
  });
});

describe("retire_card", () => {
  it("denies a viewer and a validator", async () => {
    await expect(
      asRole(db, "authenticated", VIEWER, (tx) =>
        tx.query(`select public.retire_card('scotia-gold-amex')`),
      ),
    ).rejects.toThrow(/not authorized|42501/i);

    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(`select public.retire_card('scotia-gold-amex')`),
      ),
    ).rejects.toThrow(/not authorized|42501/i);
  });

  it("sets status to rejected, audits, and hides the card from the verified-only policy", async () => {
    await asRole(db, "authenticated", ADMIN, async (tx) => {
      const { rows } = await tx.query<{ retire_card: Record<string, unknown> }>(
        `select public.retire_card('scotia-gold-amex') as retire_card`,
      );
      expect(rows[0]?.retire_card).toMatchObject({ id: "scotia-gold-amex", status: "rejected" });
      expect(await cardStatus(tx, "scotia-gold-amex")).toBe("rejected");

      const audit = await tx.query<{ action: string; actor_email: string }>(
        `select action, actor_email from public.admin_audit
         where entity = 'cards' and entity_id = 'scotia-gold-amex' and action = 'card.retire'
         order by at desc limit 1`,
      );
      expect(audit.rows[0]).toMatchObject({
        action: "card.retire",
        actor_email: "info.praxisinnovations@gmail.com",
      });

      // Same transaction: verified-only path would not return this row.
      const live = await tx.query(
        `select id from public.cards where id = 'scotia-gold-amex' and status = 'verified'`,
      );
      expect(live.rows).toEqual([]);

      const again = await tx.query<{ retire_card: Record<string, unknown> }>(
        `select public.retire_card('scotia-gold-amex') as retire_card`,
      );
      expect(again.rows[0]?.retire_card).toMatchObject({
        id: "scotia-gold-amex",
        status: "rejected",
        already: true,
      });
    });
  });

  it("lets a viewer read card history in admin_audit", async () => {
    await db.exec(`
      insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
      values (
        'info.praxisinnovations@gmail.com',
        'card.retire',
        'cards',
        'scotia-gold-amex',
        '{"status":"verified"}'::jsonb,
        '{"status":"rejected"}'::jsonb
      );
    `);

    await asRole(db, "authenticated", VIEWER, async (tx) => {
      const { rows } = await tx.query<{ action: string }>(
        `select action from public.admin_audit
         where entity = 'cards' and entity_id = 'scotia-gold-amex' and action = 'card.retire'`,
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
