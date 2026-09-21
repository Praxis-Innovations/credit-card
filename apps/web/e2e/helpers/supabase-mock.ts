import type { Page } from "@playwright/test";

const USER = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "e2e@northtap.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

type OwnedRow = { id: string; card_id: string; added_at: string };

/**
 * Intercept Supabase Auth + PostgREST so signed-in E2E works without Docker.
 * Wallet state is in-memory for the lifetime of the page routes.
 */
export async function installSupabaseMock(
  page: Page,
  options?: { initialCardIds?: string[] },
) {
  const owned: OwnedRow[] = (options?.initialCardIds ?? []).map((cardId, i) => ({
    id: `row-${i}-${cardId}`,
    card_id: cardId,
    added_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));

  let accessToken: string | null = null;

  await page.route("**/auth/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path.endsWith("/token") && method === "POST") {
      accessToken = "e2e-access-token";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "e2e-refresh-token",
          user: USER,
        }),
      });
    }

    if (path.endsWith("/user") && method === "GET") {
      if (!accessToken) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "not authenticated" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(USER),
      });
    }

    if (path.endsWith("/logout") && method === "POST") {
      accessToken = null;
      return route.fulfill({ status: 204, body: "" });
    }

    if (path.includes("/signup") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: USER, session: null }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/rest/v1/user_cards*", async (route) => {
    const req = route.request();
    const method = req.method();

    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": `0-${Math.max(owned.length - 1, 0)}/${owned.length}` },
        body: JSON.stringify(
          owned.map((row) => ({
            id: row.id,
            card_id: row.card_id,
            added_at: row.added_at,
          })),
        ),
      });
    }

    if (method === "POST") {
      const raw = req.postData() ?? "[]";
      const payload = JSON.parse(raw) as
        | { card_id: string; user_id?: string }
        | Array<{ card_id: string; user_id?: string }>;
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) {
        if (!owned.some((o) => o.card_id === row.card_id)) {
          owned.push({
            id: `row-${owned.length}-${row.card_id}`,
            card_id: row.card_id,
            added_at: new Date().toISOString(),
          });
        }
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    }

    if (method === "DELETE") {
      const url = new URL(req.url());
      // PostgREST: card_id=eq.amex-cobalt or card_id=neq.
      const filter = url.searchParams.get("card_id") ?? "";
      if (filter.startsWith("eq.")) {
        const cardId = filter.slice(3);
        const idx = owned.findIndex((o) => o.card_id === cardId);
        if (idx >= 0) owned.splice(idx, 1);
      } else if (filter.startsWith("neq.")) {
        owned.splice(0, owned.length);
      }
      return route.fulfill({ status: 204, body: "" });
    }

    return route.fulfill({ status: 405, body: "method not allowed" });
  });
}
