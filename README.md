# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending.

## Architecture

| Package | Role |
|---------|------|
| `apps/web` | Next.js — marketing `/` (landing showcase) + functional app at `/app` |
| `apps/mobile` | Expo shell (iOS / Android / Web) — richer native UX TBD |
| `packages/core` | Shared card schema, CA card dataset, valuations, recommendation engine |
| `docs/api` | OpenAPI contract for recommender + card catalog ([`docs/api/README.md`](./docs/api/README.md)) |
| `supabase` | Auth + `user_cards` ownership (RLS) |

## Quick start

```bash
pnpm install
pnpm --filter @northtap/core test   # recommendation engine unit tests
pnpm --filter web test              # API wrapper unit tests
pnpm --filter web e2e               # Playwright guest + signed-in flows
pnpm --filter web dev               # http://localhost:3000 — marketing `/` + app `/app`
pnpm --filter mobile start          # Expo shell
```

Functional purchase recommender: **http://localhost:3000/app** — amount + merchant/category → ranked cards with reasoning. Guest wallets persist in `localStorage`; with `NEXT_PUBLIC_SUPABASE_*` set, sign-in syncs to `user_cards`. Interim BFF mirrors the OpenAPI contract: `POST /api/v1/recommendations` (in-process `recommendCards` from `@northtap/core`).

Root scripts: `pnpm dev` (turbo), `pnpm build`, `pnpm lint`, `pnpm test`.

## Out of scope (marketing)

No GPS, bank linking, or AI on the marketing site. Persistent "My Cards" belongs in
authenticated clients (`/app` and `apps/mobile`).
