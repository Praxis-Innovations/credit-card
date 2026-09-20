# CardCoach

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending.

## Monorepo

| Package | Role |
|---------|------|
| `apps/web` | Next.js 15 App Router — marketing + card picker |
| `apps/mobile` | Expo Router shell (iOS / Android / Web) — UI TBD |
| `packages/core` | Card schema, ~40-card CA dataset, valuations, recommendation engine |

## Quick start

```bash
pnpm install
pnpm --filter @cardcoach/core test   # recommendation engine unit tests
pnpm --filter web dev                # http://localhost:3000
pnpm --filter mobile start           # Expo shell
```

Root scripts: `pnpm dev` (turbo), `pnpm build`, `pnpm lint`, `pnpm test`.

## Out of scope (this slice)

No GPS, bank linking, backend, or AI — everything is client-side from
`@cardcoach/core`.
