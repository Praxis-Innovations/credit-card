import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QUEUE_DIFF_KINDS } from "@/lib/review/queue";
import { applyMigrations, asRole, createMigratedDb, jwtClaims } from "@/test/supabase-db";

const MIGRATION = "20261014220000_finding_checked_status.sql";
const RUN = "00000000-0000-4000-8000-0000000000bb";
const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const scotiaId = `(select id from public.crawl_sources where issuer_name = 'Scotiabank')`;
const GOLD = "https://www.scotiabank.com/ca/en/personal/credit-cards/american-express/gold-card.html";

type Finding = { card_name: string; diff_kind: string; review_status: string; checked_at: Date | null; created_at: Date };

let db: PGlite;

type NewFinding = { card: string; kind: string; status?: string; checkedAt?: string; linked?: string; url?: string | null };

/** Inserts as the crawler does (service key, no RLS); review_status defaults to 'pending'. */
async function insertFinding(f: NewFinding) {
  const columns = ["run_id", "product_url", "card_name", "diff_kind", "linked_card_id"];
  const values: unknown[] = [RUN, f.url === undefined ? GOLD : f.url, f.card, f.kind, f.linked ?? null];
  for (const [column, value] of [["review_status", f.status], ["checked_at", f.checkedAt]] as const) {
    if (value === undefined) continue;
    columns.push(column);
    values.push(value);
  }
  await db.query(
    `insert into public.card_findings (source_id, ${columns.join(", ")})
     values (${scotiaId}, ${values.map((_, i) => `$${i + 1}`).join(", ")})`,
    values,
  );
}

async function findings(): Promise<Finding[]> {
  const { rows } = await db.query<Finding>(
    `select card_name, diff_kind, review_status, checked_at, created_at from public.card_findings order by card_name`,
  );
  return rows;
}

beforeAll(async () => {
  // Rows written by the crawler before this migration: everything 'pending'.
  db = await createMigratedDb({ before: MIGRATION });
  await db.exec(`
    insert into public.admin_users (email, role) values ('validator@example.com', 'validator');
    insert into public.crawl_runs (id, source_id, source_scope, trigger, status, started_at)
      select '${RUN}', id, 'Scotiabank', 'cli', 'done', now()
      from public.crawl_sources where issuer_name = 'Scotiabank';
  `);
  await insertFinding({ card: "a unchanged", kind: "unchanged", linked: "scotia-gold-amex" });
  await insertFinding({ card: "b changed", kind: "changed", linked: "scotia-gold-amex" });
  await insertFinding({ card: "c new", kind: "new" });
  await insertFinding({ card: "d discontinued", kind: "possibly_discontinued", linked: "scotia-scene-visa", url: null });
  await insertFinding({ card: "e approved unchanged", kind: "unchanged", status: "approved", linked: "scotia-gold-amex" });

  await applyMigrations(db, (file) => file >= MIGRATION);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("finding_checked_status migration", () => {
  it("moves pending no-change findings to checked and keeps their check time", async () => {
    const rows = await findings();
    expect(rows.map((r) => [r.card_name, r.review_status])).toEqual([
      ["a unchanged", "checked"],
      ["b changed", "pending"],
      ["c new", "pending"],
      ["d discontinued", "pending"],
      ["e approved unchanged", "approved"],
    ]);
    for (const r of rows) expect(r.checked_at).toEqual(r.created_at);
  });

  it("audits the backfill as a system change", async () => {
    const { rows } = await db.query<{ action: string; actor_email: string }>(
      `select action, actor_email from public.admin_audit where entity = 'card_findings'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("finding.checked");
    expect(rows[0]!.actor_email).toMatch(/^system:/);
  });
});

describe("checked findings", () => {
  it("cannot be stored as pending when the card has no changes", async () => {
    await expect(insertFinding({ card: "x", kind: "unchanged", linked: "scotia-gold-amex" })).rejects.toThrow(
      /card_findings_unchanged_not_pending/,
    );
  });

  it("are only for no-change findings, and must record when they were checked", async () => {
    await expect(insertFinding({ card: "x", kind: "changed", status: "checked", checkedAt: "2026-10-14T12:00:00Z" })).rejects.toThrow(
      /card_findings_checked_is_unchanged/,
    );
    await expect(insertFinding({ card: "x", kind: "unchanged", status: "checked" })).rejects.toThrow(
      /card_findings_checked_is_unchanged/,
    );
  });

  it("accept the row the crawler writes for an unchanged card", async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        `insert into public.card_findings (run_id, source_id, product_url, card_name, diff_kind, linked_card_id, review_status, checked_at)
         values ($1, ${scotiaId}, $2, 'crawler unchanged', 'unchanged', 'scotia-gold-amex', 'checked', '2026-10-14T12:00:00Z')`,
        [RUN, GOLD],
      );
      const { rows } = await tx.query<{ checked_at: Date }>(
        `select checked_at from public.card_findings where card_name = 'crawler unchanged'`,
      );
      expect(rows[0]!.checked_at.toISOString()).toBe("2026-10-14T12:00:00.000Z");
      await tx.rollback();
    });
  });

  it("cannot be reviewed, and a reviewer cannot mark a finding checked or set the check time", async () => {
    const approved = await asRole(db, "authenticated", VALIDATOR, async (tx) => {
      const res = await tx.query(`update public.card_findings set review_status = 'approved' where review_status = 'checked'`);
      return res.affectedRows ?? 0;
    });
    expect(approved).toBe(0);
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) =>
        tx.query(`update public.card_findings set review_status = 'checked' where card_name = 'b changed'`),
      ),
    ).rejects.toThrow(/row-level security|card_findings_checked_is_unchanged/);
    await expect(
      asRole(db, "authenticated", VALIDATOR, (tx) => tx.query(`update public.card_findings set checked_at = now()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("review queue", () => {
  it("lists only new, changed and possibly discontinued cards", async () => {
    const { rows } = await asRole(db, "authenticated", VALIDATOR, (tx) =>
      tx.query<{ card_name: string; diff_kind: string }>(
        `select card_name, diff_kind from public.card_findings
         where review_status = 'pending' and diff_kind = any($1)
         order by card_name`,
        [[...QUEUE_DIFF_KINDS]],
      ),
    );
    expect(rows.map((r) => r.diff_kind)).toEqual(["changed", "new", "possibly_discontinued"]);
  });
});
