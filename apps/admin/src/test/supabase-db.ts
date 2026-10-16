import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/migrations",
);

/**
 * What a Supabase project provides before user migrations run: API roles,
 * auth.uid()/auth.jwt() reading the request claims, the extensions and
 * storage schemas, and the default grants that expose new public tables to
 * anon/authenticated (so the test proves the migration revokes them).
 */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

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

/** `before`: stop at the first migration whose file name sorts at or after it. */
export async function createMigratedDb({ before }: { before?: string } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { citext } });
  await db.exec(SUPABASE_SHIM);
  await applyMigrations(db, (file) => !before || file < before);
  return db;
}

export async function applyMigrations(db: PGlite, include: (file: string) => boolean): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql") && include(f)).sort();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`${file} failed to apply: ${(err as Error).message}`);
    }
  }
}

export type Claims = {
  email: string;
  providers?: string[];
};

/** Claims shaped like a Supabase access token for a Google sign-in. */
export function jwtClaims({ email, providers = ["google"] }: Claims) {
  return {
    sub: "00000000-0000-4000-8000-000000000001",
    role: "authenticated",
    email,
    app_metadata: { provider: providers[0], providers },
  };
}

/**
 * Runs `fn` as PostgREST would for a request: inside a transaction, as the
 * given database role, with the JWT claims set. Rolled back afterwards.
 */
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  claims: object | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  let error: unknown;
  await db
    .transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        claims ? JSON.stringify(claims) : "",
      ]);
      await tx.exec(`set local role ${role}`);
      try {
        result = await fn(tx);
      } catch (err) {
        error = err;
      }
      await tx.rollback();
    })
    .catch(() => {});
  if (error) throw error;
  return result as T;
}
