import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalogWrite, type BuildCatalogWriteInput, type RewardCategory } from "@/lib/review/catalog-write";
import type { FieldDecision } from "@/lib/review/types";
import { createMigratedDb, jwtClaims } from "@/test/supabase-db";

const VALIDATOR = jwtClaims({ email: "validator@example.com" });
const RUN = "'00000000-0000-4000-8000-0000000000ac'";
const NOW = { date: "2026-10-16", iso: "2026-10-16T12:00:00.000Z" };
const CHANGED = `select id from public.card_findings where run_id = ${RUN} and diff_kind = 'changed'`;
const NEW = `select id from public.card_findings where run_id = ${RUN} and diff_kind = 'new'`;

const EXTRACTED = {
  earn_rates: [
    {
      category: "dining",
      rate: 3,
      unit: "points_per_dollar",
      quote: "3x dining",
      mccs: ["5812"],
      cap_amount: 1000,
      cap_period: "monthly",
    },
    { category: "other", rate: 1, unit: "points_per_dollar", quote: "1x everything else" },
  ],
  promotions: [
    {
      summary: "2x gas until March",
      rate: 2,
      points: null,
      categories: ["gas"],
      valid_from: "2026-01-01",
      valid_to: "2026-03-31",
      quote: "2x gas promo",
    },
  ],
};

let db: PGlite;
let existing: NonNullable<BuildCatalogWriteInput["existing"]>;

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(
    `insert into public.admin_users (email, role) values ('validator@example.com', 'validator');
     insert into public.crawl_runs (id, source_id, source_scope, trigger, status, started_at)
       select ${RUN}, id, 'Scotiabank', 'cli', 'running', now()
       from public.crawl_sources where issuer_name = 'Scotiabank';`,
  );
  for (const [kind, name, linked] of [
    ["changed", "Scotiabank Gold American Express Card", "'scotia-gold-amex'"],
    ["new", "Rewards Parity Card", "null"],
  ] as const) {
    await db.query(
      `insert into public.card_findings (run_id, source_id, product_url, card_name, extracted, diff_kind, linked_card_id)
       select ${RUN}, id, 'https://www.scotiabank.com/ca/en/personal/credit-cards/${kind}.html',
         $1, $2::jsonb, '${kind}', ${linked}
       from public.crawl_sources where issuer_name = 'Scotiabank'`,
      [name, JSON.stringify(EXTRACTED)],
    );
  }
  const { rows } = await db.query<Record<string, unknown>>(
    `select id, name, issuer, annual_fee::float8 as annual_fee, point_currency, reward_categories, welcome_offer, network
     from public.cards where id = 'scotia-gold-amex'`,
  );
  existing = rows[0] as unknown as NonNullable<BuildCatalogWriteInput["existing"]>;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

function saved(entries: Array<[string, string]>): { fields: FieldDecision[] } {
  return { fields: entries.map(([key, value]) => ({ key, save: true, page_value: "", value })) };
}

/** The write the admin app itself builds for these decisions. */
function appWrite(diffKind: "changed" | "new", fields: { fields: FieldDecision[] }) {
  const res = buildCatalogWrite({
    diffKind,
    linkedCardId: diffKind === "changed" ? "scotia-gold-amex" : null,
    cardName: diffKind === "changed" ? "Scotiabank Gold American Express Card" : "Rewards Parity Card",
    issuerName: "Scotiabank",
    fields,
    existing: diffKind === "changed" ? existing : null,
    extractedPointCurrency: null,
    extracted: EXTRACTED,
    now: NOW,
  });
  if (!res.ok || !res.write) throw new Error(`app refused the write: ${JSON.stringify(res)}`);
  return res.write.op === "insert"
    ? { op: "insert" as const, row: res.write.row }
    : { op: "update" as const, id: res.write.id, set: res.write.set };
}

/** Approve inside a rolled-back transaction; returns the card's resulting reward_categories. */
async function approve(findingSql: string, fields: unknown, cardOp: { op: string }, cardId: string) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(VALIDATOR)]);
    await tx.exec("set local role authenticated");
    await tx.query(`select public.approve_finding_to_catalog((${findingSql}), $1::jsonb, $2::jsonb)`, [
      JSON.stringify(fields),
      JSON.stringify(cardOp),
    ]);
    await tx.exec("reset role");
    const { rows } = await tx.query<{ reward_categories: RewardCategory[] }>(
      "select reward_categories from public.cards where id = $1",
      [cardId],
    );
    await tx.rollback();
    return rows[0]?.reward_categories;
  });
}

const INDEXED = saved([
  ["earn_rates[0].mccs", "5812, 5814"],
  ["earn_rates[0].cap_amount", "1,500"],
  ["earn_rates[0].cap_period", "annual"],
  ["earn_rates[1].mcc_source", "network_default"],
]);

describe("reward_categories parity with the admin app", () => {
  it.each([
    ["indexed earn-rate fields", INDEXED],
    ["an earn_rate override plus an indexed field", saved([["earn_rate.dining", "4"], ["earn_rates[0].mccs", "5812"]])],
    ["a dated promotion", saved([["promotion.0.summary", "2x gas until March"], ["promotion.0.valid_to", "2026-04-30"]])],
  ])("accepts the app's own update write for %s", async (_label, fields) => {
    const op = appWrite("changed", fields);
    if (op.op !== "update") throw new Error("expected update");
    const rewards = await approve(CHANGED, fields, op, "scotia-gold-amex");
    expect(rewards).toEqual(op.set.reward_categories);
  });

  it("accepts the app's own insert write with earn rules", async () => {
    const fields = saved([["earn_rate.dining", "3"], ["earn_rates[0].mccs", "5812"]]);
    const op = appWrite("new", fields);
    if (op.op !== "insert") throw new Error("expected insert");
    const rewards = await approve(NEW, fields, op, op.row.id);
    expect(rewards).toEqual(op.row.reward_categories);
  });
});

function tamper(op: ReturnType<typeof appWrite>, edit: (rows: RewardCategory[]) => RewardCategory[]) {
  if (op.op === "update") return { ...op, set: { ...op.set, reward_categories: edit(op.set.reward_categories!) } };
  return { ...op, row: { ...op.row, reward_categories: edit(op.row.reward_categories) } };
}

function patchDining(patch: Partial<RewardCategory>) {
  return (rows: RewardCategory[]) => rows.map((r) => (r.category === "dining" ? { ...r, ...patch } : r));
}

const MISMATCH = /card_op reward_categories does not match review_fields/;

describe("reward_categories mismatches", () => {
  it.each([
    ["the earnRate", { earnRate: 50 }],
    ["the cap", { capAnnual: 9999 }],
  ])("rejects an indexed dining row whose %s diverges", async (_label, patch) => {
    const op = tamper(appWrite("changed", INDEXED), patchDining(patch));
    await expect(approve(CHANGED, INDEXED, op, "scotia-gold-amex")).rejects.toThrow(MISMATCH);
  });

  it("rejects an extra row smuggled in alongside a saved promotion", async () => {
    const fields = saved([["promotion.0.summary", "2x gas until March"]]);
    const op = tamper(appWrite("changed", fields), (rows) => [...rows, { category: "travel", earnRate: 10 }]);
    await expect(approve(CHANGED, fields, op, "scotia-gold-amex")).rejects.toThrow(MISMATCH);
  });

  it("rejects extra categories on a new card with no saved earn rules", async () => {
    const fields = saved([["annual_fee", "0"]]);
    const op = tamper(appWrite("new", fields), (rows) => [...rows, { category: "dining", earnRate: 50 }]);
    await expect(approve(NEW, fields, op, "scotiabank-rewards-parity-card")).rejects.toThrow(MISMATCH);
  });
});
