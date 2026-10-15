# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending. Merchant partnerships can boost or replace category rates.

## Architecture

| Package | Role |
|---------|------|
| `apps/api` | Next.js — standalone public catalog + recommendation API (`/v1/*`). Owns the domain engine under `src/domain` and the Big Six data pipeline under `src/data-pipeline` (CI/CLI only, never imported by routes). Never reads wallets. |
| `apps/web` | Next.js — marketing site (no domain package dependency; category pages render a committed catalog snapshot) |
| `apps/mobile` | Expo — HTTP client of `apps/api` for catalog + recommendations; wallet via Supabase Auth+RLS only |
| `docs/api` | OpenAPI 3.1 contract (implemented by `apps/api`) |
| `supabase` | Auth, `user_cards` (wallet), catalog tables, `api_keys` |

`apps/mobile` and `apps/web` must not depend on the domain package — they speak HTTP (and hand-written wire types) only.

## Quick start

```bash
pnpm install
pnpm --filter api test              # domain + route unit tests
pnpm --filter api dev               # http://localhost:8787
pnpm --filter web dev               # http://localhost:3000
pnpm --filter mobile start          # Expo (set EXPO_PUBLIC_NORTHTAP_* in .env.local)
pnpm --filter mobile test
```

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`,
`pnpm pipeline:run | pipeline:source-health | pipeline:promote`
(see [`apps/api/src/data-pipeline/README.md`](./apps/api/src/data-pipeline/README.md)).

Regenerate catalog SQL seed (requires `NORTHTAP_SEED_API_KEY` in the environment):

```bash
pnpm seed:catalog
```

The marketing site's category pages (`/gas`, `/groceries`, `/dining`) read
`apps/web/src/data/catalog-snapshot.json`, exported from `apps/api/src/domain`
(`cards.ts` + `valuations.ts`). After changing either file, regenerate and commit
it; `pnpm --filter web test` fails while the snapshot is stale:

```bash
pnpm snapshot:catalog
```

`apps/web` reads `SITE_URL` (default `https://northtap.vercel.app`) for
canonicals, the sitemap and OG URLs. Category pages stay `noindex,follow` and
out of the sitemap until `CATEGORY_PAGES_INDEXABLE` in `apps/web/src/lib/site.ts`
is set to `true` (the catalog is unverified seed data).
