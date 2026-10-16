# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending. Merchant partnerships can boost or replace category rates.

## Architecture

| Package | Role |
|---------|------|
| `apps/api` | Next.js — standalone public catalog + recommendation API (`/v1/*`). Owns the domain engine under `src/domain` and the Big Six data pipeline under `src/data-pipeline` (CI/CLI only, never imported by routes). Never reads wallets. |
| `apps/web` | Next.js — marketing site (no domain package dependency) |
| `apps/mobile` | Expo — HTTP client of `apps/api` for catalog + recommendations; wallet via Supabase Auth+RLS only |
| `apps/admin` | Next.js — internal admin console (Google sign-in, allow-listed admins). Talks to Supabase as the signed-in admin under RLS; owns all admin write paths. Imports nothing from `apps/web` or `apps/mobile`. |
| `apps/crawler` | Node CLI — card-data crawler (Playwright + Claude). Reads `crawl_sources`, writes `crawl_runs` / `card_findings` for review with its own server-side key. Never writes `cards`. See [`apps/crawler/README.md`](./apps/crawler/README.md). |
| `e2e` | Playwright — api / web / admin / app against local Supabase. See [`e2e/README.md`](./e2e/README.md). |
| `docs/api` | OpenAPI 3.1 contract (implemented by `apps/api`) |
| `supabase` | Auth, `user_cards` (wallet), catalog tables, `api_keys` |

`apps/mobile` and `apps/web` must not depend on the domain package — they speak HTTP (and hand-written wire types) only.

## Quick start

```bash
pnpm install
scripts/setup-local-env.sh          # link shared local settings (see "Local settings")
pnpm --filter api test              # domain + route unit tests
pnpm --filter api dev               # http://localhost:8787
pnpm --filter web dev               # http://localhost:3000
pnpm --filter admin dev             # http://localhost:3100
pnpm --filter mobile start --web --port 8081   # Expo web on http://localhost:8081
pnpm --filter mobile test
pnpm --filter crawler crawl --source scotiabank --dry-run   # see apps/crawler/README.md
```

## Local settings

Real settings (`.env.local`) for `api`, `web`, `admin`, `mobile` and `crawler`
live in **one place outside the repo and its worker copies**:

```
~/.ao/data/env/credit-card/<app>.env.local     # chmod 600, never committed
```

Override the directory with `NORTHTAP_ENV_DIR`. `scripts/setup-local-env.sh`
symlinks each file to `apps/<app>/.env.local` (`--copy` copies instead; an
existing different `.env.local` is moved to `.env.local.bak.<timestamp>`; an
identical regular file is kept in `--copy` mode and replaced by the symlink in
link mode). Run
it after cloning or creating any worktree. The script contains no secrets.

To create a file, start from `apps/<app>/.env.example`:

| App | Needs |
|-----|-------|
| `api` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NORTHTAP_CATALOG_SOURCE`, `NORTHTAP_CORS_ORIGIN`, `NORTHTAP_STATIC_API_KEY` |
| `web` | nothing yet (empty file) |
| `admin` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_ORIGIN` |
| `mobile` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_NORTHTAP_API_URL`, `EXPO_PUBLIC_NORTHTAP_API_KEY` |
| `crawler` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Anthropic settings are not needed locally: local crawls use `--dry-run`; live crawls run in GitHub Actions only (see `apps/crawler/README.md`) |

The Supabase URL, publishable key, production API URL, and API key also come
from the `northtap-app` Vercel project (`vercel env pull --project northtap-app
--environment=production`). Production (and Preview, though preview deploys
are disabled — see below) must set
`EXPO_PUBLIC_NORTHTAP_API_URL=https://northtap-api.vercel.app` and
`EXPO_PUBLIC_NORTHTAP_API_KEY`. The service-role key is never committed.
`EXPO_PUBLIC_NORTHTAP_API_KEY` must equal `NORTHTAP_STATIC_API_KEY` on
`northtap-api` and hash-match an active row in `public.api_keys` (SHA-256 of
the plaintext, see `apps/api/src/lib/auth.ts`).

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`,
`pnpm pipeline:run | pipeline:source-health | pipeline:promote`
(see [`apps/api/src/data-pipeline/README.md`](./apps/api/src/data-pipeline/README.md)).

Regenerate catalog SQL seed (requires `NORTHTAP_SEED_API_KEY` in the environment):

```bash
pnpm seed:catalog
```

### Importing MCC research CSVs

Research CSVs become **`merchant_code_findings` only** (never live catalog rows).
Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Bad rows are rejected with
a reason; the rest still import. Idempotent on re-run.

```bash
pnpm import:store_codes path/to/store_codes.csv
pnpm import:test_purchases path/to/test_purchases.csv
pnpm import:mcc_codes path/to/mcc_codes.csv
pnpm import:category_mccs path/to/category_mccs.csv
pnpm import:store_type_mccs path/to/store_type_mccs.csv
```

Formats (headers exact):

| Kind | Columns |
|------|---------|
| `store_codes` | chain,wikidata_id,mcc,network,channel,certainty,source_type,url,observed_date,quote |
| `test_purchases` | date,card,statement_text,mcc_shown,category_shown,screenshot_file |
| `mcc_codes` | mcc,name,source_url |
| `category_mccs` | category,mcc,source_url |
| `store_type_mccs` | osm_tag,mcc,note |

Do not put seed MCC data in migrations. Approve findings in the admin review queue.

## Vercel deploys

Four Vercel projects share this monorepo (`northtap`, `northtap-app`,
`northtap-admin`, `northtap-api`). **Preview deployments are disabled** on all
four (`previewDeploymentsDisabled=true`) — do not re-enable them. Only
production deploys from `main` run.

Each project’s Root Directory is its app folder. On production, each
`apps/*/vercel.json` sets an **Ignored Build Step** so a push to `main` only
builds a project when that app or shared root workspace files changed
(`pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
— there is no `packages/` directory in this repo):

| Vercel project | Root Directory | Builds when these paths change |
|----------------|----------------|--------------------------------|
| `northtap` | `apps/web` | `apps/web`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| `northtap-app` | `apps/mobile` | `apps/mobile`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| `northtap-admin` | `apps/admin` | `apps/admin`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |
| `northtap-api` | `apps/api` | `apps/api`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` |

Command (exit `0` = skip build, `1` = proceed), from each `vercel.json`.
Uses `VERCEL_GIT_PREVIOUS_SHA` (last successful deploy for this project/branch)
so multi-commit pushes still build when an earlier commit touched the app;
falls back to `HEAD^` when unset. If that SHA is missing from the shallow
clone, `git` exits non-zero and the build proceeds:

```bash
cd ../.. && git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- apps/<app> pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json
```

A merge to `main` that only touches `apps/crawler`, `docs/`, `e2e/`, or other
non-listed paths triggers no production builds — which avoids hitting Vercel’s
deployment rate limit when every project would otherwise rebuild on every push.

## CI

Every PR and push to `main` runs typecheck, lint, unit tests, code-health
checks (ESLint size/complexity, knip, jscpd, dependency-cruiser with a committed
baseline), and the Playwright E2E smoke suite (local Supabase in Docker) for
api, admin, crawler, mobile and web
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)). The full E2E suite
runs nightly ([`.github/workflows/e2e.yml`](./.github/workflows/e2e.yml)).
Make the **`CI gate`** check required on `main` to block merges on failures —
see [`docs/ci.md`](./docs/ci.md).

```bash
pnpm code-health:report   # full local report
pnpm code-health          # CI gate: fail only on new violations
```

The card-data crawler runs on `main` via
[`.github/workflows/crawler.yml`](./.github/workflows/crawler.yml) (monthly
sources + pickup of requested `crawl_runs`, Claude via GitHub OIDC — see
[`apps/crawler/README.md`](./apps/crawler/README.md)).
