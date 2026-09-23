# Data pipeline (Big Six)

Recurring **staging-only** crawl for Canadian Big Six bank credit-card and
merchant-partnership pages.

## Hard rule

Raw crawler output is **never** written into production datasets
(`cards.ts`, `partnerships.ts`). This package writes:

| Path | Purpose |
|------|---------|
| `staging/*.json` | Cited facts: `sourceUrl`, `capturedAt`, issuer/brand, raw value |
| `reports/*.md` | Human-readable new / changed / removed / conflict candidates |

Promotion into production files stays a **reviewed** edit.

## Run locally

```bash
pnpm --filter @northtap/core pipeline:run
pnpm --filter @northtap/core test
```

## Schedule

GitHub Actions workflow `.github/workflows/data-pipeline.yml` runs weekly
(Monday 14:00 UTC), commits updated staging + report on branch
`data-pipeline/staging`, and opens/updates issue
**"Data pipeline review: Big Six"** with the report body.

## Compliance

- Public, unauthenticated pages only
- `robots.txt` checked per origin before fetch
- Per-host delay (~2.5s); single-threaded crawl
- Identifying `User-Agent`; no login walls
