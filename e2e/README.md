# NorthTap E2E

Playwright workspace package. Projects: **api**, **web**, **admin**, **app**
(Expo web export). Tests run against a **local** Supabase started with Docker
(`supabase start`) — never the shared hosted project.

## Prerequisites

- Docker (required by the local Supabase stack)
- Node 20+, pnpm (see root `packageManager`)
- From the repo root: `pnpm install`

## Local run

```bash
# 1. Local Supabase + migrations + seed (test users, E2E API key)
pnpm --filter e2e supabase:reset

# 2. Build and start api (8787), web (3000), admin (3100), app (8082)
pnpm --filter e2e stack:up

# 3. Smoke subset (what CI runs on every PR)
pnpm --filter e2e test:smoke

# Or the full suite (what CI runs nightly)
pnpm --filter e2e test:e2e

# Stop the Node app processes (Supabase keeps running until you stop it)
pnpm --filter e2e stack:down
npx -y supabase@2.121.0 stop
```

Use the pinned CLI (`npx -y supabase@2.121.0`) so local matches CI.

### Seeded local users

Applied only by `supabase/seed.sql` on local reset (not hosted):

| Email | Password | Notes |
|-------|----------|--------|
| `user@northtap.test` | `local-e2e-password` | App user (email identity) |
| `admin@northtap.test` | `local-e2e-password` | On `admin_users`; Google identity in `auth.identities` so `is_admin()` accepts the JWT |

API key plaintext (hashed in seed): `nt_e2e_local_only_not_for_prod` — local fixture only.

Constants live in `src/env.ts`. Fixtures/helpers: `src/fixtures.ts`, `src/helpers/`.

## CI

| When | Workflow | Suite |
|------|----------|--------|
| PR (when api/web/admin/mobile/e2e/packages/supabase change) / every push to `main` | [`ci.yml`](../.github/workflows/ci.yml) job `e2e-smoke` | `@smoke` (CI gate) |
| Nightly 06:00 UTC + manual | [`e2e.yml`](../.github/workflows/e2e.yml) | Full |

Traces, HTML report, and `test-results/` upload as artifacts on failure or success.

When the nightly full suite fails on `main`,
[`.github/scripts/report-e2e-nightly-failures.mjs`](../.github/scripts/report-e2e-nightly-failures.mjs)
opens or updates **one GitHub issue per failing Playwright project** (`api`,
`web`, `admin`, `app`) — no duplicates while an issue stays open. Each issue
lists failing tests, trace paths inside the run artifact, the last green
nightly commit, and labels `kind:agent` plus the matching `stream:` / `app:`
labels. Setup failures (no JSON report) use a single `infra` issue instead.

## Layout

```
e2e/
  playwright.config.ts   # projects: api, web, admin, app
  src/env.ts             # URLs, local keys, seeded users
  src/fixtures.ts        # shared Playwright fixtures
  src/helpers/           # API + Supabase helpers
  tests/{api,web,admin,app}/
  scripts/               # supabase-up, stack-up/down, export-supabase-env
```

Add new coverage under the matching `tests/<project>/` folder. Tag PR-blocking
cases with `{ tag: "@smoke" }`.

### Web regression (`tests/web/`)

Marketing site (Next on `:3000`):

- Hero **Try it** widget (default Gas ranking, category re-rank, keyboard radios)
- Theme toggle (`data-theme` + localStorage)
- Full-height hero (`min-h-hero` below the header)
- Key CTAs / brand home link / How it works section
- Basic SEO (`title`, description, Open Graph, `lang`)

### API regression (`tests/api/`)

`/v1` contract against the local stack (static catalog + seeded E2E API key):

- Auth (missing / invalid / valid key; public health)
- Cards list, get-by-id, not_found
- Merchant brands list/search, get-by-id, not_found
- Recommendations with `mcc` / `merchantQuery` (legacy `category` rejected)
- Shared error envelope (`unauthorized`, `not_found`, `bad_request`, `empty_wallet`)

### Admin regression (`tests/admin/`)

Full suite (nightly / `test:e2e`) covers signed-out redirect, non-admin blocked
and signed out, Sources add/edit/pause/resume and domain validation, Review
approve and reject-with-reason, and an app user reading zero admin rows under
RLS. Auth uses the seeded `admin@northtap.test` password session written into
Supabase SSR cookies (no live Google OAuth).

### App project (`tests/app/`)

Regression for the Expo web export (served on `:8082` by `stack:up`):

- First-run guest flow (intro → cards → location/store → amount → best card → save)
- Location denied, browse-instead-of-nearby, offline cached result, card-art fallback
- No saved cards (guest CTA + signed-in empty wallet)
- Google sign-in / Save your wallet (OAuth authorize is stubbed; session + `user_cards` use local Supabase)
- Responsive layouts (phone / tablet / desktop), overflow 320–1920px, and keyboard focus trap

Overpass (OSM) is mocked; the NorthTap API and local Supabase are real. Wide viewports use
`test.use({ viewport })` / `page.setViewportSize` inside `tests/app/` (default project is 390×844).
