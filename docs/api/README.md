# NorthTap API contract

OpenAPI 3.1 spec for the purchase-specific recommender and public catalog API.
Implemented by **`apps/api`** (Next.js on Vercel). Domain model + ranking live
**inside** `apps/api/src/domain`. Shared wire constants (`CATEGORIES` /
`CATEGORY_LABELS`) live in `@northtap/api-contract` for api + mobile.

| File | Role |
|------|------|
| [`openapi.yaml`](./openapi.yaml) | Source of truth for HTTP request/response shapes |

## Architecture boundary (important)

| Concern | Where it lives | Auth |
|---------|----------------|------|
| Shared catalog (cards, brands, partnerships, loyalty) | `apps/api` → Supabase catalog tables | API key |
| Stateless ranking + brand match | `apps/api/src/domain` via `POST /v1/recommendations` | API key |
| **Whose wallet** (`user_cards`) | **Only** Supabase Auth + RLS via Expo / clients | Supabase JWT |

`apps/api` **never** looks up a user’s wallet and **never** accepts a Supabase
JWT for identity. Callers always pass opaque `ownedCardIds` plus optional
`merchantQuery` (raw free-text; resolved server-side).

`apps/mobile` / `apps/web` must not import the domain package — wire types only.

## What is live

| Layer | Location | Notes |
|-------|----------|--------|
| HTTP API | `apps/api` on Vercel | Production: [northtap-api.vercel.app](https://northtap-api.vercel.app) (`/v1/*`); custom domain is PLH4 |
| Domain engine | `apps/api/src/domain` | Cards, partnerships, `recommendCards`, `matchMerchantBrand` |
| Catalog tables | Supabase migrations | Seeded from domain static data; production uses NorthTap project `bshxaqjufibgsxeauyux` |
| API keys | Supabase `api_keys` | SHA-256 hashes; plaintext never in git |
| Wallet ownership | Supabase `user_cards` | Client ↔ PostgREST + RLS only |

## Auth

Every route except `GET /v1/health` requires an API key. Set plaintext via Vercel
/ local `.env.local` — see `.env.example` templates (variable names only).

## How clients consume this

1. Load wallet ids via Supabase (`user_cards`) or guest AsyncStorage.
2. `POST /v1/recommendations` with `amountCad`, `ownedCardIds`, and `mcc`
   and/or a store (`merchantQuery` / `osmTag`). Optional `categoryFallback`
   only when the store code is unknown. Legacy `category` is rejected.
3. `GET /v1/cards` for picker UIs. Cards carry `imageUrl` / `imageAlt`; brands
   and programs carry `logoUrl` / `logoAlt`. Cards currently show a generated
   illustration; logos are null until a rights-cleared asset exists, so render
   a neutral placeholder — see [`docs/data/ASSETS.md`](../data/ASSETS.md).
4. Offline: Expo caches the last successful recommendation response and shows it
   labeled stale when the network is down (no on-device re-ranking).
