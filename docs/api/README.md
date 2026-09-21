# NorthTap API contract

OpenAPI 3.1 spec for the purchase-specific recommender and card catalog.

| File | Role |
|------|------|
| [`openapi.yaml`](./openapi.yaml) | Source of truth for HTTP request/response shapes |

This directory is **contract-only**. It does not ship a server. Backend and UI workers implement against this file (and against `@northtap/core` types, which this spec mirrors).

## What is already decided in the repo

| Layer | Location | Notes |
|-------|----------|--------|
| Card / recommendation types | `packages/core/src/schema.ts` | `CreditCard`, `Category`, `Recommendation`, … |
| Ranking engine | `packages/core/src/recommend.ts` | `centsPerDollar = earnRate × pointValue` |
| Static catalog seed | `packages/core/src/cards.ts` | ~40 CA cards; data pipeline should conform to `CreditCard` |
| Auth + owned cards | Supabase `profiles`, `user_cards` | `card_id` is a catalog slug — **no `cards` table yet** |

There is no parallel invent-your-own card schema: OpenAPI `CreditCard` ≡ `@northtap/core` `CreditCard`.

## How the frontend should consume this

1. Treat `POST /v1/recommendations` as the recommender surface:
   - Send `amountCad` + `category` (required).
   - Optional `merchant` is display / future mapping only — ranking is category-based in v1.
   - Guest / marketing flows: pass `ownedCardIds`.
   - Logged-in mobile: omit `ownedCardIds` and send the Supabase JWT; the server resolves the wallet from `user_cards`.
2. Use `GET /v1/cards` (or the static `@northtap/core` `CARDS` export during MVP) for picker UIs.
3. Prefer calling Supabase PostgREST directly for wallet CRUD (`user_cards`) as documented in [`supabase/README.md`](../../supabase/README.md). The `/me/cards` routes in the spec are the same shape if a BFF is added later.
4. Generate typed clients if useful, e.g.:

```bash
# example — pick any OpenAPI generator your stack prefers
npx openapi-typescript docs/api/openapi.yaml -o apps/mobile/src/api/schema.d.ts
```

Until a gateway exists, you can still implement the recommender **in-process** with `recommendCards()` from `@northtap/core` using the same JSON bodies — then swap the transport to HTTP without changing UI models.

## How the backend / data workers should consume this

1. **Recommendations** — Implement `POST /recommendations` by calling (or rehosting) `recommendCards()`:
   - Resolve owned ids from body or `user_cards`.
   - Rank as today; attach `estimatedCentsBack = amountCad × centsPerDollar` and `estimatedRewardCad = estimatedCentsBack / 100`.
   - Return empty `recommendations` + `bestCardId: null` when the wallet is empty or ids are unknown (or `422 empty_wallet` if you prefer a hard fail — document in the implementation; clients should handle both empty list and 422).
2. **Catalog** — `CreditCard` fields are the ingest target for the real-data worker. Keep `id` stable (slug). Update `lastVerified` on every rate change. Admin write routes (`POST/PUT/PATCH/DELETE /cards`) are for pipeline/service role, not end-user apps.
3. **Supabase** — Do not invent a second ownership model. Persist ownership only as `user_cards (user_id, card_id)`. A future `cards` table MAY back the catalog; if added, `user_cards.card_id` should remain the public slug (or become a FK to that slug).

## Validation tips

```bash
# optional — requires a local OpenAPI tooling install
npx @redocly/cli lint docs/api/openapi.yaml
# or
npx swagger-cli validate docs/api/openapi.yaml
```

## Out of scope (intentionally)

- Marketing / landing page UI
- Actual HTTP server or Supabase Edge Functions
- Spend tracking persistence, bank linking, welcome-bonus tracking (called out as future in Supabase migrations)
