import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import {
  E2E_USERS,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  urls,
} from "../env";

export function createAnonClient(): SupabaseClient {
  return createClient(urls.supabase, supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(urls.supabase, supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sign in a seeded local user with email/password. */
export async function signInAs(
  kind: keyof typeof E2E_USERS,
): Promise<{ client: SupabaseClient; session: Session }> {
  const user = E2E_USERS[kind];
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) {
    throw new Error(`E2E sign-in failed for ${user.email}: ${error?.message ?? "no session"}`);
  }
  return { client, session: data.session };
}

/** Confirm the admin seed user has Google in JWT app_metadata.providers. */
export async function assertAdminHasGoogleIdentity(): Promise<void> {
  const { session } = await signInAs("admin");
  const providers = (session.user.app_metadata?.providers ?? []) as string[];
  if (!providers.includes("google")) {
    throw new Error(
      `Expected admin@northtap.test JWT providers to include google; got ${JSON.stringify(providers)}`,
    );
  }
}
