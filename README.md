# NorthTap

Canadian credit card rewards optimizer — **tap the right card, every time.**

Deterministic rules engine (not ML): for each card you own, compute
`cents-back-per-dollar = earn_rate × point_value` for a spending category and
rank descending.

## Architecture

| Package | Role |
|---------|------|
| `apps/web` | **Marketing site only** (Next.js) — landing + session-only “try it free” picker (no persistence) |
| `apps/mobile` | **Full product** (Expo, iOS / Android / Web) — persistent wallet + richer UX (UI TBD) |
| `packages/core` | Shared card schema, ~40-card CA dataset, valuations, recommendation engine |
| `docs/api` | OpenAPI contract for recommender + card catalog ([`docs/api/README.md`](./docs/api/README.md)) |

## Quick start

```bash
pnpm install
pnpm --filter @northtap/core test   # recommendation engine unit tests
pnpm --filter web dev                # http://localhost:3000 (marketing + lead-magnet tool)
pnpm --filter mobile start           # Expo shell (full app UI comes later)
```

Root scripts: `pnpm dev` (turbo), `pnpm build`, `pnpm lint`, `pnpm test`.

## Out of scope (this slice)

No GPS, bank linking, backend, or AI. Web picker is in-memory only — persistent
“My Cards” belongs in `apps/mobile`.
