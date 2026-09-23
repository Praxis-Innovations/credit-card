# NorthTap API contract

OpenAPI 3.1 spec for the purchase-specific recommender and public catalog API.
Implemented by **`apps/api`** (Next.js on Vercel).

| File | Role |
|------|------|
| [`openapi.yaml`](./openapi.yaml) | Source of truth for HTTP request/response shapes |

## Architecture boundary (important)

| Concern | Where it lives | Auth |
|---------|----------------|------|
| Shared catalog (cards, brands, partnerships, loyalty) | `apps/api` → Supabase catalog tables | API key |
| Stateless ranking | `apps/api` calls `@northtap/core` `recommendCards` / `recommendCardsForMerchant` | API key |
| **Whose wallet** (`user_cards`) | **Only** Supabase Auth + RLS via Expo / clients | Supabase JWT |

`apps/api` **never** looks up a user’s wallet and **never** accepts a Supabase
JWT for identity. Callers always pass opaque `ownedCardIds` in the request body
(loaded by the client from `user_cards` or guest storage). The API does not know
or care whose cards those IDs are.

## What is live

| Layer | Location | Notes |
|-------|----------|--------|
| HTTP API | `apps/api` | Route handlers under `/v1/*` |
| Ranking engine | `packages/core` | Invoked **server-side** inside `POST /v1/recommendations` |
| Catalog tables | Supabase migrations | `cards`, `loyalty_programs`, `merchant_brands`, `merchant_partnerships` |
| API keys | Supabase `api_keys` | SHA-256 hashes; `X-Api-Key` / Bearer key (not JWT) |
| Wallet ownership | Supabase `user_cards` | Client ↔ PostgREST + RLS only |

Public catalog responses only include rows with `status = verified`.

## Auth

Every route except `GET /v1/health` requires an API key. Seed an internal key for
the Expo app (hash in the catalog seed migration; plaintext in
`apps/mobile/.env.example` / Vercel `EXPO_PUBLIC_NORTHTAP_API_KEY`).

## How clients consume this

1. Load wallet ids via Supabase (`user_cards`) or guest AsyncStorage — **not** via this API.
2. `POST /v1/recommendations` with `amountCad`, `category`, `ownedCardIds`, and
   optional `merchantBrandId` for partnership-aware ranking (computed on the server).
3. `GET /v1/cards` (paginated) for picker UIs.
4. Mobile keeps a small offline cache of wallet card snapshots after a successful
   recommend, and falls back to local category-only `recommendCards()` if the
   network is down (no partnership freshness guarantee).
