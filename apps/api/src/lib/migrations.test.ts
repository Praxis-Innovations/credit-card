import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CARDS, LOYALTY_PROGRAMS, MERCHANT_BRANDS } from "@/domain";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/migrations",
);

/**
 * The subset of what a Supabase project provides before user migrations run:
 * API roles, auth.users + auth.uid(), and the storage schema.
 */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null unique,
    owner uuid,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    metadata jsonb,
    created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
`;

let db: PGlite;
let migrationFiles: string[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  migrationFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrationFiles) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`${file} failed to apply: ${(err as Error).message}`);
    }
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function count(sql: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(sql);
  return Number(rows[0]!.n);
}

describe("supabase migrations", () => {
  it("applies every migration in order, including catalog_assets", () => {
    expect(migrationFiles.some((f) => f.endsWith("_catalog_assets.sql"))).toBe(
      true,
    );
  });

  it.each([
    ["cards", "image", CARDS.length],
    ["merchant_brands", "logo", MERCHANT_BRANDS.length],
    ["loyalty_programs", "logo", LOYALTY_PROGRAMS.length],
  ])(
    "seeds %s with every %s asset null and rights 'placeholder'",
    async (table, prefix, expected) => {
      expect(await count(`select count(*) as n from public.${table}`)).toBe(
        expected,
      );
      expect(
        await count(
          `select count(*) as n from public.${table}
           where ${prefix}_url is null and ${prefix}_alt is null
             and ${prefix}_source_url is null and ${prefix}_updated_at is null
             and ${prefix}_rights_status = 'placeholder'`,
        ),
      ).toBe(expected);
    },
  );

  it.each([
    ["cards", "image"],
    ["merchant_brands", "logo"],
    ["loyalty_programs", "logo"],
  ])("%s rejects a %s URL without cleared rights, alt and source", async (table, prefix) => {
    const id = (
      await db.query<{ id: string }>(`select id from public.${table} limit 1`)
    ).rows[0]!.id;
    const url = "https://example.supabase.co/storage/v1/object/public/brand-assets/x.png";

    for (const bad of [
      `${prefix}_url = '${url}'`,
      `${prefix}_url = '${url}', ${prefix}_rights_status = 'unknown', ${prefix}_alt = 'a', ${prefix}_source_url = 'https://s'`,
      `${prefix}_url = '${url}', ${prefix}_rights_status = 'licensed', ${prefix}_source_url = 'https://s'`,
      `${prefix}_url = '${url}', ${prefix}_rights_status = 'licensed', ${prefix}_alt = '  ', ${prefix}_source_url = 'https://s'`,
      `${prefix}_url = '${url}', ${prefix}_rights_status = 'licensed', ${prefix}_alt = 'a'`,
    ]) {
      await expect(
        db.query(`update public.${table} set ${bad} where id = $1`, [id]),
      ).rejects.toThrow(/provenance_check/);
    }

    await db.query(
      `update public.${table}
       set ${prefix}_url = $2, ${prefix}_alt = 'Logo', ${prefix}_source_url = 'https://press.example',
           ${prefix}_rights_status = 'issuer_provided', ${prefix}_updated_at = now()
       where id = $1`,
      [id, url],
    );
    await db.query(
      `update public.${table}
       set ${prefix}_url = null, ${prefix}_alt = null, ${prefix}_source_url = null,
           ${prefix}_rights_status = 'placeholder'
       where id = $1`,
      [id],
    );
  });

  it("lets cards store a generated illustration with alt text and no source URL", async () => {
    const url = "https://example.supabase.co/storage/v1/object/public/brand-assets/cards/generated/x.png";
    const id = CARDS[0]!.id;
    for (const alt of ["null", "'  '"]) {
      await expect(
        db.query(
          `update public.cards set image_url = $2, image_alt = ${alt}, image_rights_status = 'generated' where id = $1`,
          [id, url],
        ),
      ).rejects.toThrow(/provenance_check/);
    }
    await db.query(
      `update public.cards
       set image_url = $2, image_alt = 'Card (illustration)', image_source_url = null,
           image_rights_status = 'generated'
       where id = $1`,
      [id, url],
    );
    await db.query(
      `update public.cards set image_url = null, image_alt = null, image_rights_status = 'placeholder' where id = $1`,
      [id],
    );
  });

  it.each([["merchant_brands"], ["loyalty_programs"]])(
    "%s does not accept generated logos",
    async (table) => {
      const id = (await db.query<{ id: string }>(`select id from public.${table} limit 1`)).rows[0]!.id;
      await expect(
        db.query(
          `update public.${table}
           set logo_url = 'https://x/y.png', logo_alt = 'a', logo_source_url = 'https://s',
               logo_rights_status = 'generated'
           where id = $1`,
          [id],
        ),
      ).rejects.toThrow(/provenance_check/);
    },
  );

  it("creates the public brand-assets bucket for raster images only", async () => {
    const { rows } = await db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      `select public, file_size_limit, allowed_mime_types
       from storage.buckets where id = 'brand-assets'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.public).toBe(true);
    expect(Number(rows[0]!.file_size_limit)).toBe(1048576);
    expect(rows[0]!.allowed_mime_types).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
  });

  it("allows public reads and only service_role writes on brand-assets objects", async () => {
    const { rows } = await db.query<{
      policyname: string;
      cmd: string;
      roles: string[] | string;
    }>(
      `select policyname, cmd, roles from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'brand_assets_%'
       order by policyname`,
    );
    const byCmd = new Map<string, string[]>();
    for (const r of rows) {
      const roles = Array.isArray(r.roles)
        ? r.roles
        : String(r.roles).replace(/[{}]/g, "").split(",");
      byCmd.set(r.cmd, [...(byCmd.get(r.cmd) ?? []), ...roles]);
    }
    expect(byCmd.get("SELECT")?.sort()).toEqual(["anon", "authenticated"]);
    for (const cmd of ["INSERT", "UPDATE", "DELETE"]) {
      expect(byCmd.get(cmd)).toEqual(["service_role"]);
    }
  });
});
