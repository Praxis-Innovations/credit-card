# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending. Merchant partnerships can boost or replace category rates.

## Architecture

| Package | Role |
|---------|------|
| `apps/api` | Next.js — standalone public catalog + recommendation API (`/v1/*`). Owns the domain engine under `src/domain`. Never reads wallets. |
| `apps/web` | Next.js — marketing site (no domain package dependency) |
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

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`.

Regenerate catalog SQL seed (requires `NORTHTAP_SEED_API_KEY` in the environment):

```bash
pnpm seed:catalog
```
