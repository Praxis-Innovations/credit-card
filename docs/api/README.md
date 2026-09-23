# NorthTap API contract

OpenAPI 3.1 spec for the purchase-specific recommender and public catalog API.
Implemented by **`apps/api`** (Next.js on Vercel).

| File | Role |
|------|------|
| [`openapi.yaml`](./openapi.yaml) | Source of truth for HTTP request/response shapes |

## What is live

| Layer | Location | Notes |
|-------|----------|--------|
| HTTP API | `apps/api` | Route handlers under `/v1/*` |
| Ranking engine | `packages/core` | `recommendCards` / `recommendCardsForMerchant` |
| Catalog tables | Supabase migrations | `cards`, `loyalty_programs`, `merchant_brands`, `merchant_partnerships` |
| API keys | Supabase `api_keys` | SHA-256 hashes; `X-Api-Key` / Bearer |
| Wallet ownership | Supabase `user_cards` | Still via PostgREST + RLS from Expo |

Public responses only include rows with `status = verified`.

## Auth

Every route except `GET /v1/health` requires an API key. Seed an internal key for
the Expo app (hash in the catalog seed migration; plaintext in
`apps/mobile/.env.example` / Vercel `EXPO_PUBLIC_NORTHTAP_API_KEY`).

## How clients consume this

1. `POST /v1/recommendations` with `amountCad`, `category`, `ownedCardIds`, and
   optional `merchantBrandId` for partnership-aware ranking.
2. `GET /v1/cards` (paginated) for picker UIs — do not ship the static
   `@northtap/core` `CARDS` array in apps.
3. Prefer Supabase PostgREST for wallet CRUD (`user_cards`).
