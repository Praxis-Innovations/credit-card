# Data pipeline (Big Six)

Recurring **staging-only** crawl for Canadian Big Six bank credit-card and
merchant-partnership pages, with status lifecycle tied to Supabase catalog
tables (`pending` → `verified` → `stale` | `rejected`).

## Hard rule

Raw crawler output is **never** written into production datasets
(`cards.ts`, `partnerships.ts`, or Supabase) without a human. This package writes:

| Path | Purpose |
|------|---------|
| `staging/*.json` | Cited facts: `sourceUrl`, `capturedAt`, issuer/brand, raw value, `status=pending` |
| `reports/*.md` | Human-readable candidates (conflicts include corroboration) |
| `state/review-decisions.json` | Rejected fingerprints so weekly diffs stop re-flagging |

**Not on the public `@northtap/core` barrel.** The crawler is Node/CI-only
(`node:url`, cheerio, etc.) and must not be pulled into `apps/web` or Expo.
Import via `@northtap/core/data-pipeline` or run the `pipeline:*` scripts
(`tsx src/data-pipeline/run.ts`, etc.).

Promotion uses `pipeline:promote` → Supabase upsert with `status=verified`,
`verified_at=now()`, `reviewed_by=<reviewer>`.

## Status lifecycle

| Status | Meaning |
|--------|---------|
| `pending` | Staged finding / not yet reviewed |
| `verified` | Human-promoted into catalog (public API reads these) |
| `stale` | Source-health failed (dead link / claim missing) or manually marked |
| `rejected` | Reviewed and confirmed wrong — fingerprint suppressed on later diffs |

## Cadence

| Job | Schedule | What |
|-----|----------|------|
| Source-health | Daily 12:00 UTC | GET + claim presence on verified `sourceUrl`s; flip to `stale` |
| Partnerships | 15th monthly | Bi-weekly promo / merchant partnership crawl |
| Full (cards+partnerships) | 1st monthly | Base card rates/fees + partnerships |
| Promote | `workflow_dispatch` | Apply approvals JSON to Supabase |

Offer expiry phrases (`valid until…`) are extracted when present and flagged
`expiry_review_due` within 14 days of the cited date.

## Corroboration

Conflict findings fetch an alternate cited `sourceUrl` (when one exists) and
record whether the third page agrees with staging, production, both, or neither.
If only one source exists, the report says so explicitly.

## Commands

```bash
pnpm --filter @northtap/core pipeline:run              # PIPELINE_SCOPE=full|cards|partnerships
pnpm --filter @northtap/core pipeline:source-health
pnpm --filter @northtap/core pipeline:promote -- --file path/to/approvals.json [--dry-run]
pnpm --filter @northtap/core test
```

Secrets (Actions / local env, **never committed**):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Schema: `supabase/migrations/20260923000000_catalog_and_api_keys.sql` plus
`20260923120000_pipeline_review_decisions.sql` (`reviewed_by`,
`pipeline_review_decisions`).

## Compliance

- Public, unauthenticated pages only
- `robots.txt` checked per origin before fetch
- Per-host delay (~2.5s); single-threaded crawl
- Identifying `User-Agent`; no login walls
