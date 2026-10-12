import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";
import { fetchAdminRole } from "@/lib/auth/roles";

/**
 * /not-authorized is public because users who fail the allow-list are signed
 * out before being sent there.
 */
export const PUBLIC_PATHS = ["/login", "/auth/callback", "/not-authorized"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Redirect while keeping any auth cookies Supabase set on `from`. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) res.cookies.set(cookie);
  return res;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() verifies the token with the Auth server; getSession() alone
  // would trust whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectKeepingCookies(request, response, "/login");

  const role = await fetchAdminRole(supabase);
  if (!role) {
    // Local scope: end only this console session, not the user's app sessions.
    await supabase.auth.signOut({ scope: "local" });
    return redirectKeepingCookies(request, response, "/not-authorized");
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/).*)"],
};
