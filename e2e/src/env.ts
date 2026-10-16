/**
 * Local-only E2E settings. These values are fixtures for `supabase start`,
 * never production secrets. The JWT pair is Supabase's public local demo keys.
 */

/** Well-known local Supabase demo JWTs (safe to commit; only valid locally). */
const LOCAL_SUPABASE = {
  url: "http://127.0.0.1:54321",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  serviceRoleKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
} as const;

/**
 * Plaintext API key accepted by the local stack and hashed in `supabase/seed.sql`.
 * Not a production secret — local E2E only.
 */
const E2E_API_KEY = "nt_e2e_local_only_not_for_prod";

/** Password shared by every seeded local auth user (seed.sql). */
const E2E_PASSWORD = "local-e2e-password";

export const E2E_USERS = {
  /** Regular app user (email/password identity). */
  app: {
    email: "user@northtap.test",
    password: E2E_PASSWORD,
  },
  /**
   * Admin allow-list user with a linked Google identity in seed.sql.
   * Password sign-in still works locally; JWT `app_metadata.providers`
   * includes `google` so `public.is_admin()` accepts the session.
   */
  admin: {
    email: "admin@northtap.test",
    password: E2E_PASSWORD,
  },
} as const;

export const urls = {
  api: process.env.E2E_API_URL ?? "http://127.0.0.1:8787",
  web: process.env.E2E_WEB_URL ?? "http://127.0.0.1:3000",
  admin: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:3100",
  app: process.env.E2E_APP_URL ?? "http://127.0.0.1:8082",
  supabase: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? LOCAL_SUPABASE.url,
};

export function supabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    LOCAL_SUPABASE.anonKey
  );
}

export function supabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SUPABASE.serviceRoleKey;
}

export function apiKey(): string {
  return process.env.NORTHTAP_STATIC_API_KEY ?? process.env.E2E_API_KEY ?? E2E_API_KEY;
}
