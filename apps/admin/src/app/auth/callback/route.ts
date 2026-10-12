import { NextResponse, type NextRequest } from "next/server";
import { adminOrigin } from "@/lib/env";
import { fetchAdminRole } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Google → Supabase → here with a PKCE code. Redirects only to our own origin. */
export async function GET(request: NextRequest) {
  const origin = adminOrigin();
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth`);

  const role = await fetchAdminRole(supabase);
  if (!role) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(`${origin}/not-authorized`);
  }
  return NextResponse.redirect(`${origin}/sources`);
}
