"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminOrigin } from "@/lib/env";
import { isAllowedOrigin } from "@/lib/auth/origin";
import { createServerSupabase } from "@/lib/supabase/server";

async function assertSameOrigin(): Promise<boolean> {
  return isAllowedOrigin((await headers()).get("origin"), adminOrigin());
}

export async function signInWithGoogle(): Promise<void> {
  if (!(await assertSameOrigin())) redirect("/login?error=origin");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${adminOrigin()}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (!(await assertSameOrigin())) redirect("/sources");
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
