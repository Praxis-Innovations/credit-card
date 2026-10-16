import type { Session } from "@supabase/supabase-js";
import type { Page, Request } from "@playwright/test";

export interface GoogleOAuthBypass {
  authorizeUrls: string[];
}

/**
 * Local Supabase does not enable the Google provider. For sign-in E2E we
 * pretend Google is on and complete the authorize redirect with a real
 * local session (from email/password of a seeded user). user_cards and
 * other PostgREST traffic still hit local Supabase.
 */
export async function installGoogleOAuthBypass(
  page: Page,
  session: Session,
  options: { googleEnabled?: boolean } = {},
): Promise<GoogleOAuthBypass> {
  const googleEnabled = options.googleEnabled ?? true;
  const mock: GoogleOAuthBypass = { authorizeUrls: [] };

  await page.route("**/auth/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path.endsWith("/settings")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ external: { google: googleEnabled, email: true } }),
      });
    }

    if (path.endsWith("/authorize")) {
      mock.authorizeUrls.push(req.url());
      if (!googleEnabled) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "provider_disabled",
            error_description: "Google is off",
          }),
        });
      }
      const redirectTo = url.searchParams.get("redirect_to") ?? "/";
      const expiresAt =
        session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
      const hash = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: String(session.expires_in ?? 3600),
        expires_at: String(expiresAt),
        token_type: "bearer",
        provider_token: "google-e2e-token",
      });
      return route.fulfill({
        status: 302,
        headers: { location: `${redirectTo}#${hash.toString()}` },
      });
    }

    // Session / user / token refresh still talk to local GoTrue.
    return route.fallback();
  });

  return mock;
}

/** Capture recommendation POSTs to the local API (real stack, not a mock). */
export function watchRecommendationBodies(page: Page) {
  const bodies: Array<Record<string, unknown>> = [];
  const handler = (req: Request) => {
    if (req.method() !== "POST") return;
    const url = req.url();
    if (!url.includes("/v1/recommendations")) return;
    try {
      bodies.push(req.postDataJSON() as Record<string, unknown>);
    } catch {
      /* ignore non-JSON */
    }
  };
  page.on("request", handler);
  return {
    bodies,
    dispose: () => page.off("request", handler),
  };
}
