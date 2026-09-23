# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending. Merchant partnerships can boost or replace category rates.

## Architecture

| Package | Role |
|---------|------|
| `apps/api` | Next.js — public catalog + recommendation API (`/v1/*`) |
| `apps/web` | Next.js — marketing site |
| `apps/mobile` | Expo Router — purchase recommender (calls `apps/api`) |
| `packages/core` | Shared schema, ranking engine, seed datasets |
| `docs/api` | OpenAPI 3.1 contract (implemented by `apps/api`) |
| `supabase` | Auth, `user_cards`, catalog tables, `api_keys` |

## Quick start

```bash
pnpm install
pnpm --filter @northtap/core test
pnpm --filter api test              # API route unit tests
pnpm --filter api dev               # http://localhost:8787
pnpm --filter web dev               # http://localhost:3000
pnpm --filter mobile start          # Expo (set EXPO_PUBLIC_NORTHTAP_* from .env.example)
pnpm --filter mobile test
```

Root scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`.

Regenerate catalog SQL seed from `@northtap/core`:

```bash
pnpm --filter @northtap/core exec node --experimental-strip-types ../../scripts/generate-catalog-seed.ts
```
