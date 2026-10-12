import type { Page } from "@playwright/test";

const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "e2e@northtap.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

export interface SupabaseMock {
  /** URLs of every /auth/v1/authorize request (the Google redirect). */
  authorizeUrls: string[];
  /** Rows POSTed to user_cards. */
  inserted: Array<{ user_id: string; card_id: string }>;
}

/**
 * Supabase Auth + PostgREST stand-in. `googleEnabled` drives
 * /auth/v1/settings; with `completeOAuth` the authorize request redirects
 * straight back with an implicit-flow session, as Google + Supabase would.
 */
export async function installSupabaseMock(
  page: Page,
  options: { googleEnabled: boolean; completeOAuth?: boolean; remoteCardIds?: string[] },
): Promise<SupabaseMock> {
  const mock: SupabaseMock = { authorizeUrls: [], inserted: [] };
  const owned = [...(options.remoteCardIds ?? [])];

  await page.route("**/auth/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path.endsWith("/settings")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ external: { google: options.googleEnabled, email: true } }),
      });
    }

    if (path.endsWith("/authorize")) {
      mock.authorizeUrls.push(req.url());
      const redirectTo = url.searchParams.get("redirect_to") ?? "/";
      if (!options.completeOAuth) {
        return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" });
      }
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const hash = new URLSearchParams({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_in: "3600",
        expires_at: String(expiresAt),
        token_type: "bearer",
        provider_token: "google-token",
      });
      return route.fulfill({
        status: 302,
        headers: { location: `${redirectTo}#${hash.toString()}` },
      });
    }

    if (path.endsWith("/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(USER),
      });
    }

    if (path.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });

    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.route("**/rest/v1/user_cards*", async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(owned.map((card_id, i) => ({ card_id, added_at: `2026-01-0${i + 1}` }))),
      });
    }
    if (method === "POST") {
      const payload = JSON.parse(req.postData() ?? "[]") as
        | { user_id: string; card_id: string }
        | Array<{ user_id: string; card_id: string }>;
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        mock.inserted.push(row);
        if (!owned.includes(row.card_id)) owned.push(row.card_id);
      }
      return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
    }
    if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ status: 405, body: "method not allowed" });
  });

  return mock;
}
