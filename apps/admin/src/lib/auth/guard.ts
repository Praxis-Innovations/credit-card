import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminOrigin } from "@/lib/env";
import { isAllowedOrigin } from "@/lib/auth/origin";
import { fetchAdminRole, hasRole, type AdminRole } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

export type ConsoleSession = {
  supabase: SupabaseClient;
  email: string;
  role: AdminRole;
};

export type AuthFailure = {
  ok: false;
  code: "bad_origin" | "unauthenticated" | "forbidden";
  message: string;
};

const FAILURE_MESSAGES: Record<AuthFailure["code"], string> = {
  bad_origin: "This request did not come from the admin console.",
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "Your role can't make this change.",
};

function fail(code: AuthFailure["code"]): AuthFailure {
  return { ok: false, code, message: FAILURE_MESSAGES[code] };
}

/**
 * Gate for every mutation (server action or route handler): the Origin header
 * must be the console's own origin, the session must verify with the Auth
 * server (getUser, never getSession), and the allow-list role must meet
 * `minRole`. RLS enforces the same rule again in the database.
 */
export async function authorizeMutation(
  minRole: AdminRole,
): Promise<({ ok: true } & ConsoleSession) | AuthFailure> {
  const requestHeaders = await headers();
  if (!isAllowedOrigin(requestHeaders.get("origin"), adminOrigin())) {
    return fail("bad_origin");
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return fail("unauthenticated");
  const role = await fetchAdminRole(supabase);
  if (!role || !hasRole(role, minRole)) return fail("forbidden");
  return { ok: true, supabase, email: user.email, role };
}

/** For Server Components: the verified console session, or a redirect. Cached per request. */
export const requireConsoleSession = cache(async (): Promise<ConsoleSession> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const role = await fetchAdminRole(supabase);
  if (!role) redirect("/not-authorized");
  return { supabase, email: user.email, role };
});
