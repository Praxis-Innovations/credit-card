# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending.

## Architecture

| Package | Role |
|---------|------|
| `apps/web` | **Marketing site** (Next.js) — landing showcase; live recommender is at `/app` |
| `apps/mobile` | **Full product** (Expo, iOS / Android / Web) — persistent wallet + richer UX (UI TBD) |
| `packages/core` | Shared card schema, ~40-card CA dataset, valuations, recommendation engine |
| `docs/api` | OpenAPI contract for recommender + card catalog ([`docs/api/README.md`](./docs/api/README.md)) |

## Quick start

```bash
pnpm install
pnpm --filter @northtap/core test   # recommendation engine unit tests
pnpm --filter web dev                # http://localhost:3000 (marketing landing)
pnpm --filter mobile start           # Expo shell (full app UI comes later)
```

Root scripts: `pnpm dev` (turbo), `pnpm build`, `pnpm lint`, `pnpm test`.

Live purchase-specific recommender UI: `/app` (see recommender-app work).

## Out of scope (this slice)

No GPS, bank linking, or AI on the marketing site. Persistent "My Cards" belongs in
authenticated clients (`/app` and `apps/mobile`).
