import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const ADMIN_TABLES = [
  "admin_users",
  "admin_audit",
  "crawl_sources",
  "discovered_card_urls",
  "crawl_runs",
  "card_findings",
] as const;

const ADMIN = jwtClaims({ email: "info.praxisinnovations@gmail.com" });
const APP_USER = jwtClaims({ email: "someone@example.com" });

let db: PGlite;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`
    insert into public.admin_users (email, role) values
      ('validator@example.com', 'validator'),
      ('viewer@example.com', 'viewer');
    insert into public.admin_users (email, role, active) values
      ('former@example.com', 'admin', false);
    insert into public.discovered_card_urls (source_id, card_name, product_url)
      select id, 'Passport Visa Infinite',
        'https://www.scotiabank.com/ca/en/personal/credit-cards/visa/passport-infinite-card.html'
      from public.crawl_sources where issuer_name = 'Scotiabank';
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

async function count(tx: Transaction, table: string): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return rows[0]!.n;
}

async function affected(tx: Transaction, sql: string): Promise<number> {
  const res = await tx.query(sql);
  return res.affectedRows ?? 0;
}

const scotiaId = `(select id from public.crawl_sources where issuer_name = 'Scotiabank')`;

describe("seed", () => {
  it("allow-lists the owner as admin and seeds Scotiabank as the only source", async () => {
    const admins = await db.query<{ role: string; active: boolean }>(
      "select role, active from public.admin_users where email = 'info.praxisinnovations@gmail.com'",
    );
    expect(admins.rows).toEqual([{ role: "admin", active: true }]);

    const { rows } = await db.query(
      "select issuer_name, compare_url, url_pattern, schedule, status from public.crawl_sources",
    );
    expect(rows).toEqual([
      {
        issuer_name: "Scotiabank",
        compare_url: "https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html",
        url_pattern: "/credit-cards/",
        schedule: "monthly",
        status: "active",
      },
    ]);
  });

  it("enables RLS on every admin table", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relname = any($1)`,
      [ADMIN_TABLES],
    );
    expect(rows).toHaveLength(ADMIN_TABLES.length);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

describe("a normal app user's JWT", () => {
  it.each(ADMIN_TABLES)("reads zero rows from %s", async (table) => {
    expect(await asRole(db, "authenticated", APP_USER, (tx) => count(tx, table))).toBe(0);
  });

  it("is not an admin", async () => {
    const { rows } = await asRole(db, "authenticated", APP_USER, (tx) =>
      tx.query<{ ok: boolean; role: string | null }>(
        "select public.is_admin('viewer') as ok, public.current_admin_role() as role",
      ),
    );
    expect(rows[0]).toEqual({ ok: false, role: null });
  });

  it("cannot insert a crawl source", async () => {
    await expect(
      asRole(db, "authenticated", APP_USER, (tx) =>
        tx.query("insert into public.crawl_sources (issuer_name) values ('Evil Bank')"),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot add itself to the allow-list", async () => {
    await expect(
      asRole(db, "authenticated", APP_USER, (tx) =>
        tx.query("insert into public.admin_users (email, role) values ('someone@example.com', 'admin')"),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot insert discovered card URLs or audit rows", async () => {
    await expect(
      asRole(db, "authenticated", APP_USER, (tx) =>
        tx.query(
          `insert into public.discovered_card_urls (source_id, card_name, product_url)
           values (${scotiaId}, 'x', 'https://www.scotiabank.com/x')`,
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/);
    await expect(
      asRole(db, "authenticated", APP_USER, (tx) =>
        tx.query(
          `insert into public.admin_audit (actor_email, action, entity, entity_id)
           values ('x', 'x', 'x', 'x')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("updates and deletes nothing", async () => {
    const counts = await asRole(db, "authenticated", APP_USER, async (tx) => [
      await affected(tx, "update public.crawl_sources set notes = 'pwned'"),
      await affected(tx, "update public.admin_users set role = 'admin', active = true"),
      await affected(tx, "update public.discovered_card_urls set included = false"),
      await affected(tx, "delete from public.crawl_sources"),
      await affected(tx, "delete from public.admin_users"),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0]);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.crawl_sources where notes = 'pwned'",
    );
    expect(rows[0]!.n).toBe(0);
  });

  it("is denied when it claims an admin's email without a Google identity", async () => {
    const spoof = jwtClaims({ email: "info.praxisinnovations@gmail.com", providers: ["email"] });
    expect(await asRole(db, "authenticated", spoof, (tx) => count(tx, "crawl_sources"))).toBe(0);
  });

  it("is denied for a deactivated admin", async () => {
    const former = jwtClaims({ email: "former@example.com" });
    expect(await asRole(db, "authenticated", former, (tx) => count(tx, "crawl_sources"))).toBe(0);
  });
});

describe("anon", () => {
  it.each(ADMIN_TABLES)("has no access to %s", async (table) => {
    await expect(asRole(db, "anon", null, (tx) => count(tx, table))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cannot call the role functions", async () => {
    await expect(
      asRole(db, "anon", null, (tx) => tx.query("select public.is_admin('viewer')")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("console roles", () => {
  it("lets a viewer read sources but not change them", async () => {
    const viewer = jwtClaims({ email: "viewer@example.com" });
    const [n, updated] = await asRole(db, "authenticated", viewer, async (tx) => [
      await count(tx, "crawl_sources"),
      await affected(tx, "update public.crawl_sources set notes = 'x'"),
    ]);
    expect(n).toBe(1);
    expect(updated).toBe(0);
  });

  it("does not let a validator edit sources", async () => {
    const validator = jwtClaims({ email: "Validator@Example.com" });
    await expect(
      asRole(db, "authenticated", validator, (tx) =>
        tx.query("insert into public.crawl_sources (issuer_name) values ('Koho')"),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets an admin read everything and matches the email case-insensitively", async () => {
    const shouty = jwtClaims({ email: "INFO.PraxisInnovations@gmail.com" });
    const counts = await asRole(db, "authenticated", shouty, async (tx) => ({
      sources: await count(tx, "crawl_sources"),
      urls: await count(tx, "discovered_card_urls"),
      admins: await count(tx, "admin_users"),
    }));
    expect(counts).toEqual({ sources: 1, urls: 1, admins: 4 });
  });

  it("rejects a duplicate issuer name regardless of case", async () => {
    await expect(
      asRole(db, "authenticated", ADMIN, (tx) =>
        tx.query("insert into public.crawl_sources (issuer_name) values ('scotiabank')"),
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("admin_audit", () => {
  type AuditRow = {
    actor_email: string;
    action: string;
    entity: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };

  async function auditFor(tx: Transaction, issuer: string): Promise<AuditRow[]> {
    const { rows } = await tx.query<AuditRow>(
      `select a.actor_email, a.action, a.entity, a.before, a.after
       from public.admin_audit a
       join public.crawl_sources s on s.id::text = a.entity_id
       where s.issuer_name = $1 order by a.id`,
      [issuer],
    );
    return rows;
  }

  it("records create, update, pause, resume and robots checks with the actor", async () => {
    const rows = await asRole(db, "authenticated", ADMIN, async (tx) => {
      await tx.query(
        "insert into public.crawl_sources (issuer_name, compare_url, status) values ('Koho', 'https://www.koho.ca/credit/', 'active')",
      );
      await tx.query("update public.crawl_sources set notes = 'Prepaid' where issuer_name = 'Koho'");
      await tx.query("update public.crawl_sources set status = 'paused' where issuer_name = 'Koho'");
      await tx.query("update public.crawl_sources set status = 'active' where issuer_name = 'Koho'");
      await tx.query(
        "update public.crawl_sources set robots_status = 'allowed', robots_checked_at = now() where issuer_name = 'Koho'",
      );
      return auditFor(tx, "Koho");
    });

    expect(rows.map((r) => r.action)).toEqual([
      "source.create",
      "source.update",
      "source.pause",
      "source.resume",
      "source.robots_check",
    ]);
    expect(rows.every((r) => r.actor_email === "info.praxisinnovations@gmail.com")).toBe(true);
    expect(rows.every((r) => r.entity === "crawl_sources")).toBe(true);
    expect(rows[0]!.before).toBeNull();
    expect(rows[1]!.before).toMatchObject({ notes: null });
    expect(rows[1]!.after).toMatchObject({ notes: "Prepaid" });
  });

  it("cannot be edited or deleted, even by an admin", async () => {
    await expect(
      asRole(db, "authenticated", ADMIN, (tx) => tx.query("delete from public.admin_audit")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db, "authenticated", ADMIN, (tx) => tx.query("update public.admin_audit set action = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("crawler tables", () => {
  const VALIDATOR = jwtClaims({ email: "validator@example.com" });
  const VIEWER = jwtClaims({ email: "viewer@example.com" });
  const RUN = "'00000000-0000-4000-8000-0000000000aa'";

  it("lets every console role read runs and findings", async () => {
    for (const claims of [ADMIN, VALIDATOR, VIEWER]) {
      const counts = await asRole(db, "authenticated", claims, async (tx) => [
        await count(tx, "crawl_runs"),
        await count(tx, "card_findings"),
      ]);
      expect(counts).toEqual([1, 1]);
    }
  });

  it("lets an admin request a run but not fabricate a finished one", async () => {
    await asRole(db, "authenticated", ADMIN, (tx) =>
      tx.query(`insert into public.crawl_runs (source_id, source_scope, status) values (${scotiaId}, 'Scotiabank', 'requested')`),
    );
    await expect(
      asRole(db, "authenticated", ADMIN, (tx) =>
        tx.query(`insert into public.crawl_runs (source_id, source_scope, status) values (${scotiaId}, 'Scotiabank', 'done')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let validators or viewers request runs", async () => {
    for (const claims of [VALIDATOR, VIEWER]) {
      await expect(
        asRole(db, "authenticated", claims, (tx) =>
          tx.query(`insert into public.crawl_runs (source_scope) values ('Scotiabank')`),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("lets a validator record a review decision and nothing else", async () => {
    const reviewed = await asRole(db, "authenticated", VALIDATOR, (tx) =>
      affected(
        tx,
        `update public.card_findings set review_status = 'approved', reviewed_by = 'validator@example.com', reviewed_at = now()
         where run_id = ${RUN}`,
      ),
    );
    expect(reviewed).toBe(1);
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(`update public.card_findings set extracted = '{}'::jsonb where run_id = ${RUN}`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let a viewer review findings", async () => {
    const n = await asRole(db, "authenticated", VIEWER, (tx) =>
      affected(tx, `update public.card_findings set review_status = 'rejected' where run_id = ${RUN}`),
    );
    expect(n).toBe(0);
  });

  it("requires a page URL unless the card is possibly discontinued, and a catalog card if it is", async () => {
    await expect(
      db.query(
        `insert into public.card_findings (run_id, source_id, diff_kind) values (${RUN}, ${scotiaId}, 'new')`,
      ),
    ).rejects.toThrow(/card_findings_page_or_discontinued/);
    await expect(
      db.query(
        `insert into public.card_findings (run_id, source_id, diff_kind) values (${RUN}, ${scotiaId}, 'possibly_discontinued')`,
      ),
    ).rejects.toThrow(/card_findings_discontinued_links_card/);
  });

  it("requires an error message on failed runs", async () => {
    await expect(
      db.query(`insert into public.crawl_runs (source_scope, status) values ('Scotiabank', 'failed')`),
    ).rejects.toThrow(/crawl_runs_failed_has_error/);
  });
});

describe("finding review", () => {
  const VALIDATOR = jwtClaims({ email: "validator@example.com" });
  const VIEWER = jwtClaims({ email: "viewer@example.com" });
  const RUN = "'00000000-0000-4000-8000-0000000000aa'";
  const pending = `where run_id = ${RUN} and review_status = 'pending'`;

  type Audit = {
    actor_email: string;
    action: string;
    entity: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  async function findingAudit(tx: Transaction): Promise<Audit[]> {
    const { rows } = await tx.query<Audit>(
      `select actor_email, action, entity, before, after from public.admin_audit
       where entity = 'card_findings' order by id`,
    );
    return rows;
  }

  it("denies anon any review", async () => {
    await expect(
      asRole(db, "anon", null, (tx) =>
        tx.query(`update public.card_findings set review_status = 'approved' ${pending}`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("reviews nothing for an app user or a deactivated admin", async () => {
    for (const claims of [APP_USER, jwtClaims({ email: "former@example.com" })]) {
      const n = await asRole(db, "authenticated", claims, (tx) =>
        affected(tx, `update public.card_findings set review_status = 'approved' ${pending}`),
      );
      expect(n).toBe(0);
    }
  });

  it("lets a viewer read findings but not review them", async () => {
    const [seen, reviewed] = await asRole(db, "authenticated", VIEWER, async (tx) => [
      await count(tx, "card_findings"),
      await affected(
        tx,
        `update public.card_findings set review_status = 'rejected', review_note = 'no' ${pending}`,
      ),
    ]);
    expect([seen, reviewed]).toEqual([1, 0]);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.admin_audit where entity = 'card_findings'");
    expect(rows[0]!.n).toBe(0);
  });

  it("lets a validator approve once, stamps the reviewer from the JWT, and audits field edits", async () => {
    const fields = JSON.stringify({
      fields: [{ key: "annual_fee", save: true, page_value: "59", value: "599" }],
    });
    const out = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      const first = await affected(
        tx,
        `update public.card_findings
         set review_status = 'approved',
             review_fields = '${fields}'::jsonb,
             reviewed_by = 'someone.else@example.com',
             reviewed_at = '2000-01-01'
         ${pending}`,
      );
      const second = await affected(
        tx,
        `update public.card_findings set review_status = 'rejected', review_note = 'changed my mind' ${pending}`,
      );
      await tx.exec("reset role");
      const { rows } = await tx.query<{
        review_status: string;
        reviewed_by: string;
        reviewed_at: Date;
        review_fields: { fields: Array<{ key: string; value: string }> };
      }>(`select review_status, reviewed_by, reviewed_at, review_fields from public.card_findings where run_id = ${RUN}`);
      const audit = await findingAudit(tx);
      await tx.rollback();
      return { first, second, finding: rows[0]!, audit };
    });

    expect(out.first).toBe(1);
    expect(out.second).toBe(0);
    expect(out.finding.review_status).toBe("approved");
    expect(out.finding.reviewed_by).toBe("validator@example.com");
    expect(out.finding.review_fields).toEqual({
      fields: [{ key: "annual_fee", save: true, page_value: "59", value: "599" }],
    });
    expect(new Date(out.finding.reviewed_at).getFullYear()).toBeGreaterThan(2020);
    expect(out.audit).toHaveLength(1);
    expect(out.audit[0]).toMatchObject({
      actor_email: "validator@example.com",
      action: "finding.approve",
      entity: "card_findings",
      before: { review_status: "pending" },
      after: {
        review_status: "approved",
        reviewed_by: "validator@example.com",
        card_name: "Scotiabank Gold American Express Card",
        linked_card_id: "scotia-gold-amex",
        review_fields: {
          fields: [{ key: "annual_fee", save: true, page_value: "59", value: "599" }],
        },
        edits: [{ key: "annual_fee", from: "59", to: "599" }],
      },
    });
    // The extraction payload stays on card_findings, not in the log.
    expect(out.audit[0]!.after).not.toHaveProperty("extracted");
  });

  it("omits unsaved edited fields from audit edits", async () => {
    const fields = JSON.stringify({
      fields: [
        { key: "annual_fee", save: true, page_value: "59", value: "599" },
        { key: "name", save: false, page_value: "Gold", value: "Gold Amex" },
      ],
    });
    const audit = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
      await tx.exec("set local role authenticated");
      await tx.query(
        `update public.card_findings
         set review_status = 'approved', review_fields = '${fields}'::jsonb
         ${pending}`,
      );
      await tx.exec("reset role");
      const rows = await findingAudit(tx);
      await tx.rollback();
      return rows;
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.after.edits).toEqual([{ key: "annual_fee", from: "59", to: "599" }]);
    expect(audit[0]!.after.review_fields).toEqual({
      fields: [
        { key: "annual_fee", save: true, page_value: "59", value: "599" },
        { key: "name", save: false, page_value: "Gold", value: "Gold Amex" },
      ],
    });
  });

  it("does not let a validator write review_fields without deciding the finding", async () => {
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(
          `update public.card_findings
           set review_fields = '{"fields":[]}'::jsonb
           ${pending}`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("requires a note to reject, and audits the rejection with it", async () => {
    for (const note of ["", "'  '"]) {
      await expect(
        asRole(db, "authenticated", VALIDATOR, (tx) =>
          tx.query(
            `update public.card_findings set review_status = 'rejected'${note ? `, review_note = ${note}` : ""} ${pending}`,
          ),
        ),
      ).rejects.toThrow(/card_findings_rejected_has_note/);
    }

    const audit = await asRole(db, "authenticated", ADMIN, async (tx) => {
      await tx.query(
        `update public.card_findings set review_status = 'rejected', review_note = 'Fee is wrong' ${pending}`,
      );
      return findingAudit(tx);
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor_email: "info.praxisinnovations@gmail.com",
      action: "finding.reject",
      after: { review_status: "rejected", review_note: "Fee is wrong" },
    });
  });

  it("only allows approved or rejected, and only the decision columns", async () => {
    for (const status of ["ignored", "pending"]) {
      await expect(
        asRole(db, "authenticated", VALIDATOR, (tx) =>
          tx.query(`update public.card_findings set review_status = '${status}' ${pending}`),
        ),
      ).rejects.toThrow(/row-level security/);
    }
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(`update public.card_findings set diff_kind = 'new' ${pending}`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let a validator read the audit log", async () => {
    expect(await asRole(db, "authenticated", VALIDATOR, (tx) => count(tx, "admin_audit"))).toBe(0);
  });

  it("recording the finding decision alone does not mutate cards (catalog write is AD2)", async () => {
    const cards = () => db.query<{ n: number }>("select count(*)::int as n from public.cards");
    const before = (await cards()).rows[0]!.n;
    await asRole(db, "authenticated", VALIDATOR, (tx) =>
      tx.query(`update public.card_findings set review_status = 'approved' ${pending}`),
    );
    expect((await cards()).rows[0]!.n).toBe(before);
  });
});
