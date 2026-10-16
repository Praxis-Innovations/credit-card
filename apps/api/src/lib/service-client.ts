import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role Supabase client for CLI / server jobs (never import from client apps). */
export function createServiceClient(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (env / Actions secrets — never commit keys).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
