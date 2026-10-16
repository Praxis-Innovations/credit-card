import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const VIEWER = jwtClaims({ email: "viewer@example.com" });

let db: PGlite;
let seq = 0;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into public.admin_users (email, role) values
      ('validator@example.com', 'validator'),
      ('viewer@example.com', 'viewer')
    on conflict (email) do update set role = excluded.role, active = true;
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

/** Insert as service role (no RLS), like the research importer. */
async function insertStoreFinding(
  chain: string,
  mcc: string,
  sourceType: string,
  network = "visa",
  channel = "in_store",
): Promise<string> {
  seq += 1;
  const url = `https://example.com/ad6/${seq}`;
  const { rows } = await db.query<{ id: string }>(
    `insert into public.merchant_code_findings (kind, idempotency_key, proposed)
     values (
       'store_code', $1,
       jsonb_build_object(
         'chain', $2::text, 'mcc', $3::text, 'network', $6::text, 'channel', $7::text,
         'certainty', 'confirmed', 'source_type', $4::text, 'url', $5::text,
         'observed_date', '2026-01-15', 'quote', 'quoted evidence'
       )
     ) returning id`,
    [
      `${chain.toLowerCase()}|${url}|${network}|${channel}`,
      chain,
      mcc,
      sourceType,
      url,
      network,
      channel,
    ],
  );
  return rows[0]!.id;
}

async function brandStatus(tx: Transaction, chain: string) {
  const { rows } = await tx.query<{ status: string; mcc: string }>(
    `select status::text, mcc from public.merchant_brands where lower(name) = lower($1)`,
    [chain],
  );
  return rows[0];
}

describe("approve_merchant_code_finding", () => {
  it("writes evidence and audits; Verified needs 2 sources", async () => {
    const id1 = await insertStoreFinding("AD6 Test Chain", "5411", "issuer_merchant_list");
    const id2 = await insertStoreFinding("AD6 Test Chain", "5411", "blog");

    const result = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, 'first')`, [id1]);
      const afterOne = await brandStatus(tx, "AD6 Test Chain");
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, 'second')`, [id2]);
      const afterTwo = await brandStatus(tx, "AD6 Test Chain");
      await tx.exec("reset role");
      const audits = await tx.query<{ n: number }>(
        `select count(*)::int as n from public.admin_audit
         where entity = 'merchant_code_findings' and entity_id in ($1, $2)`,
        [id1, id2],
      );
      return { afterOne, afterTwo, auditCount: audits.rows[0]?.n ?? 0 };
    });

    expect(result.afterOne).toMatchObject({ status: "pending", mcc: "5411" });
    expect(result.afterTwo).toMatchObject({ status: "verified", mcc: "5411" });
    expect(result.auditCount).toBe(2);
  });

  it("sets Conflict when approved evidence disagrees on MCC", async () => {
    const idA = await insertStoreFinding("AD6 Conflict Chain", "5310", "issuer_merchant_list");
    const idB = await insertStoreFinding("AD6 Conflict Chain", "5411", "blog");
    const status = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [idA]);
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [idB]);
      return (await brandStatus(tx, "AD6 Conflict Chain"))?.status;
    });
    expect(status).toBe("conflict");
  });

  it("keeps a pre-existing verified brand verified after one MCC finding", async () => {
    // Seed catalog includes Shell as verified with no MCC evidence.
    const before = await db.query<{ status: string }>(
      `select status::text from public.merchant_brands where id = 'shell'`,
    );
    expect(before.rows[0]?.status).toBe("verified");

    const id = await insertStoreFinding("Shell", "5541", "blog");
    const after = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [id]);
      const { rows } = await tx.query<{ status: string; mcc: string }>(
        `select status::text, mcc from public.merchant_brands where id = 'shell'`,
      );
      return rows[0];
    });

    expect(after).toMatchObject({ status: "verified", mcc: "5541" });
  });

  it("does not Conflict when Visa and Amex codes differ", async () => {
    const visa = await insertStoreFinding(
      "AD6 Amex Override",
      "5411",
      "issuer_merchant_list",
      "visa",
    );
    const amex = await insertStoreFinding("AD6 Amex Override", "5300", "blog", "amex");
    const brand = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [visa]);
      await tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [amex]);
      const { rows } = await tx.query<{ status: string; mcc: string; amex_mcc: string }>(
        `select status::text, mcc, amex_mcc from public.merchant_brands
         where lower(name) = lower('AD6 Amex Override')`,
      );
      return rows[0];
    });
    expect(brand?.status).not.toBe("conflict");
    expect(brand).toMatchObject({ mcc: "5411", amex_mcc: "5300", status: "pending" });
  });

  it("rejects require a reason and leave the brand untouched", async () => {
    const id = await insertStoreFinding("AD6 Reject Chain", "5812", "blog");
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(`select public.reject_merchant_code_finding($1::uuid, '')`, [id]),
      ),
    ).rejects.toThrow();

    const outcome = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      await tx.query(`select public.reject_merchant_code_finding($1::uuid, 'not credible')`, [id]);
      const finding = await tx.query<{ review_status: string }>(
        `select review_status from public.merchant_code_findings where id = $1`,
        [id],
      );
      const brands = await tx.query(
        `select 1 from public.merchant_brands where lower(name) = lower('AD6 Reject Chain')`,
      );
      return { review_status: finding.rows[0]?.review_status, brandCount: brands.rows.length };
    });
    expect(outcome.review_status).toBe("rejected");
    expect(outcome.brandCount).toBe(0);
  });

  it("does not let a viewer approve", async () => {
    const id = await insertStoreFinding("AD6 Viewer Chain", "5541", "blog");
    await expect(
      asRole(db, "authenticated", VIEWER, (tx: Transaction) =>
        tx.query(`select public.approve_merchant_code_finding($1::uuid, null)`, [id]),
      ),
    ).rejects.toThrow(/not authorized/i);
  });
});
