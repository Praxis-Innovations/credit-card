# NorthTap API contract

OpenAPI 3.1 spec for the purchase-specific recommender and public catalog API.
Implemented by **`apps/api`** (Next.js on Vercel). Domain model + ranking live
**inside** `apps/api/src/domain` — not a shared workspace package for clients.

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
| HTTP API | `apps/api` | Route handlers under `/v1/*` |
| Domain engine | `apps/api/src/domain` | Cards, partnerships, `recommendCards`, `matchMerchantBrand` |
| Catalog tables | Supabase migrations | Seeded from domain static data |
| API keys | Supabase `api_keys` | SHA-256 hashes; plaintext never in git |
| Wallet ownership | Supabase `user_cards` | Client ↔ PostgREST + RLS only |

## Auth

Every route except `GET /v1/health` requires an API key. Set plaintext via Vercel
/ local `.env.local` — see `.env.example` templates (variable names only).

## How clients consume this

1. Load wallet ids via Supabase (`user_cards`) or guest AsyncStorage.
2. `POST /v1/recommendations` with `amountCad`, `category`, `ownedCardIds`, and
   optional `merchantQuery` (e.g. OSM place name) for partnership-aware ranking.
3. `GET /v1/cards` for picker UIs.
4. Offline: Expo caches the last successful recommendation response and shows it
   labeled stale when the network is down (no on-device re-ranking).
