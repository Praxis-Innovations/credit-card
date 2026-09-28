# NorthTap mobile (Expo)

Expo Router app for iOS, Android and web. First run is value first, sign-in last:

intro → pick your cards → location (or browse) → store → amount (optional, $100 default) → best card → "Save your wallet" (Google).

Guests keep their wallet on the device. Signing in with Google merges it into `user_cards`.

## Run it

```bash
cp .env.example .env.local   # fill in the values below
pnpm install
pnpm --filter mobile start   # or: pnpm --filter mobile web
```

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (auth + `user_cards`). |
| `EXPO_PUBLIC_NORTHTAP_API_URL` | NorthTap API, e.g. `http://localhost:8787`. |
| `EXPO_PUBLIC_NORTHTAP_API_KEY` | Static API key. Keep it in `.env.local` and never commit it. |
| `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` | Optional. The consent line on the Save sheet only shows when both are set. |

All data comes from the API (`src/lib/api-client.ts`). The only local config is the
short "Common cards" list of card ids in `src/lib/common-cards.ts`. Nearby stores come
from OpenStreetMap (Overpass), which the device calls directly. The user's location is
never sent to NorthTap's API.

## Google sign-in setup

Sign-in is Google-only, through Supabase Auth (`signInWithOAuth({ provider: "google" })`).
If the Google provider is off, the Save sheet says "Google sign-in isn't set up…". The
app checks `/auth/v1/settings` before redirecting.

### 1. Google Cloud OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), open **APIs & Services → OAuth consent screen**. Set it up as **External** with app name "NorthTap", a support email, and the `openid`, `email` and `profile` scopes.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorized redirect URIs**, add the Supabase callback (not the app URL):
   - Hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Local Supabase CLI: `http://127.0.0.1:54321/auth/v1/callback`
4. Copy the **Client ID** and **Client secret**.

Native iOS and Android still use this same Web client. Supabase handles the Google leg,
and the app only opens the Supabase authorize URL in an in-app browser.

### 2. Supabase provider

- **Hosted:** in Dashboard → **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.
- **Local CLI:** in `supabase/config.toml`:

  ```toml
  [auth.external.google]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
  skip_nonce_check = true
  ```

  Then export those two env vars and restart with `npx supabase stop && npx supabase start`.

### 3. Redirect URLs (Supabase allow list)

In Dashboard → **Authentication → URL Configuration → Redirect URLs** (or
`additional_redirect_urls` under `[auth]` in `config.toml`), allow every place the app
returns to:

| Where | App sends `redirectTo` | Allow-list entry (dev project) |
| --- | --- | --- |
| Expo web, local | `http://localhost:8081/result` | `http://localhost:8081/**` |
| Expo web, production | `https://northtap-app.vercel.app/result` | `https://northtap-app.vercel.app/**` |
| iOS / Android dev or store build | `northtap://auth/callback` | `northtap://**` |
| Expo Go | `exp://<lan-ip>:8081/--/auth/callback` | not allowed in dev; use a dev build |

Use `localhost`, not `127.0.0.1`, for local web: the allow list matches the host exactly.
If `redirectTo` isn't allowed, Supabase silently sends the user to the Site URL instead.

On web, Supabase returns tokens in the URL hash and the client reads them on load
(implicit flow). On native, the app uses PKCE: the in-app browser returns
`northtap://auth/callback?code=…` and the app exchanges the code itself. The web host
must fall back to `index.html` for unknown paths (single-page export), so that `/result`
loads after the redirect.

## Tests

```bash
pnpm --filter mobile test   # Vitest unit tests (src/**/*.test.ts)
pnpm --filter mobile lint   # tsc
pnpm --filter mobile e2e    # Playwright on the static web export, with API/Supabase/Overpass mocks
```

The E2E build sets `EXPO_NO_DOTENV=1`, so your `.env.local` (real key) never ends up in
the test bundle.
