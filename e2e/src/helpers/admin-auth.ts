import { createBrowserClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";
import { supabaseAnonKey, urls } from "../env";
import { signInAs } from "./supabase";

type CookieRow = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * Write a Supabase SSR session into the Playwright browser context so the
 * admin Next.js middleware sees the same cookies a real Google sign-in would.
 */
export async function applySessionCookies(
  context: BrowserContext,
  session: Session,
): Promise<void> {
  const jar: CookieRow[] = [];
  const client = createBrowserClient(urls.supabase, supabaseAnonKey(), {
    isSingleton: false,
    cookies: {
      getAll: () => jar.map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          const idx = jar.findIndex((row) => row.name === cookie.name);
          if (!cookie.value) {
            if (idx >= 0) jar.splice(idx, 1);
            continue;
          }
          if (idx >= 0) jar[idx] = cookie;
          else jar.push(cookie);
        }
      },
    },
  });

  const { error } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) {
    throw new Error(`Failed to materialize admin session cookies: ${error.message}`);
  }
  if (jar.length === 0) {
    throw new Error("Supabase SSR wrote no session cookies after setSession");
  }

  const admin = new URL(urls.admin);
  await context.addCookies(
    jar.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: admin.hostname,
      path: typeof cookie.options?.path === "string" ? cookie.options.path : "/",
      httpOnly: Boolean(cookie.options?.httpOnly ?? false),
      secure: Boolean(cookie.options?.secure ?? false),
      sameSite: "Lax" as const,
    })),
  );
}

export async function signInAdminBrowser(context: BrowserContext): Promise<Session> {
  const { session } = await signInAs("admin");
  await applySessionCookies(context, session);
  return session;
}

export async function signInAppUserBrowser(context: BrowserContext): Promise<Session> {
  const { session } = await signInAs("app");
  await applySessionCookies(context, session);
  return session;
}
