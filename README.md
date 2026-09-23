# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending.

## Architecture

| Package | Role |
|---------|------|
| `apps/web` | Next.js — marketing `/` (landing showcase) + functional app at `/app` |
| `apps/mobile` | Expo Router app (iOS / Android / Web) — purchase recommender + wallet + auth |
| `packages/core` | Shared card schema, CA card dataset, merchant partnerships, valuations, recommendation engine. Big Six data-pipeline lives under `packages/core/src/data-pipeline` (CI/CLI only — not on the public `@northtap/core` barrel) |
| `docs/api` | OpenAPI contract for recommender + card catalog ([`docs/api/README.md`](./docs/api/README.md)) |
| `supabase` | Auth + `user_cards` ownership (RLS) |

## Quick start

```bash
pnpm install
pnpm --filter @northtap/core test   # recommendation engine unit tests
pnpm --filter web test              # API wrapper unit tests
pnpm --filter web e2e               # Playwright guest + signed-in flows (Next /app)
pnpm --filter web dev               # http://localhost:3000 — marketing `/` + app `/app`
pnpm --filter mobile start          # Expo (iOS / Android / Web)
pnpm --filter mobile web            # Expo web (Metro)
pnpm --filter mobile export:web     # Static web export → apps/mobile/dist
pnpm --filter mobile test           # Recommend-wrapper unit tests
pnpm --filter mobile e2e            # Playwright against Expo static web export
```

Functional purchase recommender (Next, still live): **http://localhost:3000/app** — amount + merchant/category → ranked cards with reasoning. Guest wallets persist in `localStorage`; with `NEXT_PUBLIC_SUPABASE_*` set, sign-in syncs to `user_cards`. Interim BFF mirrors the OpenAPI contract: `POST /api/v1/recommendations` (in-process `recommendCards` from `@northtap/core`).

Expo app (`apps/mobile`) is the forward path for the same flow on iOS / Android / Web — calls `recommendCards()` in-process, persists guest wallets in AsyncStorage, and syncs signed-in wallets to the same `user_cards` table via `EXPO_PUBLIC_SUPABASE_*`.

Root scripts: `pnpm dev` (turbo), `pnpm build`, `pnpm lint`, `pnpm test`.

## Out of scope (marketing)

No GPS, bank linking, or AI on the marketing site. Persistent "My Cards" belongs in
authenticated clients (`/app` and `apps/mobile`).
