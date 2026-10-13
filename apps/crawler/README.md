# apps/crawler — NorthTap card-data crawler

Phase 1: Scotiabank trial. Reads an issuer's compare page from
`crawl_sources`, finds the individual card pages, extracts each card's facts
with Claude (every value backed by a verbatim quote), checks them in code,
diffs them against the `cards` catalog and records the result for human
review. Nothing is ever written to `cards`.

## Run it locally

```bash
pnpm install
pnpm --filter crawler exec playwright install chromium   # once

cp apps/crawler/.env.example apps/crawler/.env.local     # fill in values

# Full run: writes crawl_runs, card_findings, discovered_card_urls
pnpm --filter crawler crawl --source scotiabank

# Same, but nothing is written to the database
pnpm --filter crawler crawl --source scotiabank --dry-run

# No API key needed: fetch the compare page, pick card links heuristically,
# fetch and clean every card page. Good for testing fetching and discovery.
pnpm --filter crawler crawl --source scotiabank --dry-run --no-llm
```

Options: `--limit N` (first N card pages only), `--model <id>` (default
`$CRAWLER_MODEL`, else `claude-sonnet-5-5`; `claude-haiku-4-5-20251001` for a
cheaper comparison), `--no-llm`, `--dry-run`.

### Environment (`apps/crawler/.env.local`, gitignored)

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Any run without `--no-llm`. Missing → the CLI stops with a clear message. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Reading `crawl_sources` / `cards`, writing runs and findings. Optional for `--dry-run`, which then uses a built-in Scotiabank source and skips the catalog diff. |
| `CRAWLER_MODEL` | Optional model override. |
| `CRAWLER_PRICE_INPUT_PER_MTOK`, `CRAWLER_PRICE_OUTPUT_PER_MTOK` | Optional cost-estimate override (USD per million tokens). |

The service-role key lives only in the crawler's environment. No app imports
the crawler, and the crawler imports no app.

A non-dry run needs the `*_admin_console.sql` and `*_crawler_runs_findings.sql`
migrations applied (`supabase db push`).

## Flow

1. **Source**: `crawl_sources` row by issuer name. Must be `active`.
2. **Fetch** (`fetcher.ts`, `browser.ts`): headless Chromium via Playwright,
   one page at a time, 3–5 s between requests to a host, at most 2 retries
   (network errors and 5xx only). The user agent is
   `NorthTapBot/0.1 (+contact: info.praxisinnovations@gmail.com)`. Images,
   media and fonts are never downloaded. Accordions/tabs inside `<main>`
   (e.g. "Rates and fees") are opened without following links.
3. **robots.txt** (`robots.ts`) is checked before every URL (and again after
   a redirect). Disallowed → logged and skipped. A 5xx/unreachable robots.txt
   is a full disallow (RFC 9309); 401/403/429 on robots.txt is a block.
4. **Blocks**: HTTP 403/429 or a CAPTCHA/challenge page → logged and skipped,
   never retried. No proxies, stealth plugins or UA changes, ever.
5. **Clean** (`clean.ts`): main content only; nav, page header/footer, cookie
   banners, scripts, media and footnote superscripts stripped. Same-site links
   are collected for discovery.
6. **Discover** (`extract/claude.ts`, `links.ts`): Claude gets the compare
   page text and its same-site links and returns the card product pages.
   URLs not on the page are rejected; `url_pattern` is an extra path filter.
   Links an admin marked `included = false` are skipped.
7. **Extract**: Claude fills the fixed schema in `extract/schema.ts` through a
   forced tool call. Every value is `{ value, quote }` or `null` (never a
   guess).
8. **Check** (`checks.ts`): the quote must appear verbatim in the page text
   (only whitespace and typography are normalised), the value must appear in
   its quote, and numbers must be in range (fee 0–1000, APR 0–40, earn rate
   0–20 pts/$ or 0–15 %, …). Failures are flagged, not dropped.
9. **Hash skip** (`hash.ts`): SHA-256 of the cleaned text. If a page is
   unchanged since its last extraction (database history, else
   `output/cache.json`), the previous extraction is reused and Claude is not
   called. Same for the compare page's link discovery.
10. **Diff** (`diff.ts`) against `cards` for the issuer: `new`, `changed`
    (fee, network, per-category earn rates, welcome-bonus points), `unchanged`,
    and `possibly_discontinued` for catalog cards no page matched (skipped when
    `--limit` is used). Matching uses `discovered_card_urls.linked_card_id`
    first, then a normalised name.
11. **Record**: `crawl_runs` (status, counts, tokens, cost estimate, skipped
    pages), `card_findings` (`review_status = 'pending'`), and
    `discovered_card_urls`. Each run is also saved to
    `apps/crawler/output/<run-id>/`:
    - `compare/`: page text, links, picked card links
    - `pages/NN-slug.txt`: cleaned card page text
    - `extractions/NN-slug.json`: extraction, checks and diff
    - `summary.json`

`runCrawl()` in `src/run.ts` takes all side effects as arguments, so a
scheduled workflow can call it with the same stores and fetcher the CLI uses.

## Decisions

- No-rewards cards are included; student versions are separate cards.
- Only issuer-owned pages are crawled. No third-party sites.

## Tests

```bash
pnpm --filter crawler test       # Claude, Playwright and the network are mocked
pnpm --filter crawler typecheck
pnpm --filter crawler lint
```

RLS for `crawl_runs` / `card_findings` is tested with the other admin tables
in `apps/admin/src/db/rls.test.ts`.
