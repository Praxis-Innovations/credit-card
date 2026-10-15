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
| `docs/api` | OpenAPI 3.1 contract (implemented by `apps/api`) |
| `supabase` | Auth, `user_cards` (wallet), catalog tables, `api_keys` |

`apps/mobile` and `apps/web` must not depend on the domain package — they speak HTTP (and hand-written wire types) only.

## Quick start

```bash
pnpm install
pnpm --filter api test              # domain + route unit tests
pnpm --filter api dev               # http://localhost:8787
pnpm --filter web dev               # http://localhost:3000
pnpm --filter admin dev             # http://localhost:3100 (copy apps/admin/.env.example to .env.local)
pnpm --filter mobile start          # Expo (set EXPO_PUBLIC_NORTHTAP_* in .env.local)
pnpm --filter mobile test
pnpm --filter crawler crawl --source scotiabank --dry-run   # see apps/crawler/README.md
```

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`,
`pnpm pipeline:run | pipeline:source-health | pipeline:promote`
(see [`apps/api/src/data-pipeline/README.md`](./apps/api/src/data-pipeline/README.md)).

Regenerate catalog SQL seed (requires `NORTHTAP_SEED_API_KEY` in the environment):

```bash
pnpm seed:catalog
```

## CI

Every PR and push to `main` runs typecheck, lint, unit tests, and code-health
checks (ESLint size/complexity, knip, jscpd, dependency-cruiser with a committed
baseline) for api, admin, crawler, mobile and web
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)). Make the **`CI gate`**
check required on `main` to block merges on failures — see [`docs/ci.md`](./docs/ci.md).

```bash
pnpm code-health:report   # full local report
pnpm code-health          # CI gate: fail only on new violations
```

The card-data crawler runs on `main` via
[`.github/workflows/crawler.yml`](./.github/workflows/crawler.yml) (monthly
sources + pickup of requested `crawl_runs`, Claude via GitHub OIDC — see
[`apps/crawler/README.md`](./apps/crawler/README.md)).
