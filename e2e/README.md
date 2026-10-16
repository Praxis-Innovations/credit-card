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
| Every PR / push to `main` | [`ci.yml`](../.github/workflows/ci.yml) job `e2e-smoke` | `@smoke` (CI gate) |
| Nightly 06:00 UTC + manual | [`e2e.yml`](../.github/workflows/e2e.yml) | Full |

Traces, HTML report, and `test-results/` upload as artifacts on failure or success.

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

### Admin regression (`tests/admin/`)

Full suite (nightly / `test:e2e`) covers signed-out redirect, non-admin blocked
and signed out, Sources add/edit/pause/resume and domain validation, Review
approve and reject-with-reason, and an app user reading zero admin rows under
RLS. Auth uses the seeded `admin@northtap.test` password session written into
Supabase SSR cookies (no live Google OAuth).
