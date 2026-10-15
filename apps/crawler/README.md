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

# Check Claude auth (see "Claude authentication" below)
pnpm --filter crawler auth:check

# Full run: writes crawl_runs, card_findings, discovered_card_urls
pnpm --filter crawler crawl --source scotiabank

# Same, but nothing is written to the database
pnpm --filter crawler crawl --source scotiabank --dry-run

# No Claude at all: fetch the compare page, pick card links heuristically,
# fetch and clean every card page. A --dry-run with no Claude credentials
# configured does this automatically.
pnpm --filter crawler crawl --source scotiabank --dry-run --no-llm
```

Options: `--limit N` (first N card pages only), `--model <id>` (default
`$CRAWLER_MODEL`, else `claude-sonnet-5-5`; `claude-haiku-5-5` for a
cheaper comparison), `--no-llm`, `--dry-run`.

### Environment (`apps/crawler/.env.local`, gitignored)

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `CRAWLER_WIF_IDENTITY` (+ `CRAWLER_WIF_GCP_SERVICE_ACCOUNT` for `gcloud`) | Any run that calls Claude. See [Claude authentication](#claude-authentication). With none set, `--dry-run` runs without Claude; a full run stops with a clear message. |
| `ANTHROPIC_WORKSPACE_ID` | Only if the federation rule covers more than one workspace. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Reading `crawl_sources` / `cards`, writing runs and findings. Optional for `--dry-run`, which then uses a built-in Scotiabank source and skips the catalog diff. |
| `CRAWLER_MODEL` | Optional model override. |
| `CRAWLER_PRICE_INPUT_PER_MTOK`, `CRAWLER_PRICE_OUTPUT_PER_MTOK` | Optional cost-estimate override (USD per million tokens). |

The service-role key lives only in the crawler's environment. No app imports
the crawler, and the crawler imports no app.

A non-dry run needs the `*_admin_console.sql` and `*_crawler_runs_findings.sql`
migrations applied (`supabase db push`).

## Claude authentication

The crawler never uses an Anthropic API key. It authenticates with
[Workload Identity Federation](https://platform.claude.com/docs/en/manage-claude/workload-identity-federation)
(WIF): it gets a short-lived OIDC identity token (a JWT) from an identity
provider, and the official SDK (`oidcFederationProvider` in
`@anthropic-ai/sdk`) exchanges it at `POST /v1/oauth/token` for a short-lived
Anthropic access token bound to a service account, then refreshes it before
it expires. A fresh JWT is minted for every exchange (JWTs carrying a `jti`
are single-use).

All of this lives in `src/auth.ts`; `createClaudeClient()` is the only place
a Claude client is built. `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` are
ignored (the client is built with `apiKey: null` because the SDK would
otherwise let them override WIF) and a warning is printed if they are set.

| Where | `CRAWLER_WIF_IDENTITY` | Identity token from |
| --- | --- | --- |
| Your Mac | `gcloud` | `gcloud auth print-identity-token --impersonate-service-account=$CRAWLER_WIF_GCP_SERVICE_ACCOUNT --audiences=https://api.anthropic.com --include-email`, using your own gcloud login. No key file. |
| GitHub Actions (later) | `github-actions` (auto-detected) | The job's GitHub OIDC token (`permissions: id-token: write`), audience `https://api.anthropic.com`. No secret in the repo. |
| Alternative local | `aws` | `aws sts get-web-identity-token` with your AWS CLI login (needs a current AWS CLI v2 and outbound web identity federation enabled on the account). |
| Anything else | `file` | A JWT at `ANTHROPIC_IDENTITY_TOKEN_FILE`, which must be rotated before each refresh. |

`pnpm --filter crawler auth:check` runs the three steps separately (get the
identity token and print its non-secret claims, exchange it, make a
one-token Claude call), so a misconfiguration shows which step failed. A
denied exchange is always an opaque `401 Authentication failed`. The actual
reason (e.g. `match_subject_prefix`) is on the attempt's entry in Claude
Console → Settings → Workload identity → authentication history.

### One-time Claude Console setup (an org admin does this)

Claude Console → **Settings → Workload identity → Connect workload**. Use
the GitHub Actions tile and then the Google Cloud tile; the wizard creates
the issuer, service account and rule. The values below are for this repo.

1. **Organization ID**: Settings → Organization. This is
   `ANTHROPIC_ORGANIZATION_ID`.
2. **Service account**: `northtap-crawler` (one service account for CI and
   local runs; its usage shows up under that name). Optionally create a
   `crawler` workspace and add the service account to it, so crawler usage
   and rate limits are separate. Otherwise it uses the default workspace. Its
   `svac_…` ID is `ANTHROPIC_SERVICE_ACCOUNT_ID`.
3. **Issuer: GitHub Actions**: name `github-actions`, issuer URL
   `https://token.actions.githubusercontent.com`, JWKS: discovery.
4. **Rule: GitHub Actions on `main`**:
   ```json
   {
     "name": "northtap-crawler-gha-main",
     "match": {
       "subject_prefix": "repo:Praxis-Innovations/credit-card:ref:refs/heads/main",
       "audience": "https://api.anthropic.com",
       "claims": {
         "repository_owner": "Praxis-Innovations",
         "repository": "Praxis-Innovations/credit-card",
         "ref": "refs/heads/main"
       }
     },
     "target": { "type": "service_account", "service_account_id": "svac_…" },
     "workspace_id": "wrkspc_…",
     "oauth_scope": "workspace:developer",
     "token_lifetime_seconds": 600
   }
   ```
   This matches only workflow runs on `main` (scheduled runs and manual
   `workflow_dispatch` from `main` have
   `sub = repo:Praxis-Innovations/credit-card:ref:refs/heads/main`). Pull
   requests (`…:pull_request`), other branches and forks are rejected. If the
   later workflow uses a GitHub environment (e.g. `environment: crawler`),
   the `sub` becomes `repo:Praxis-Innovations/credit-card:environment:crawler`;
   change `subject_prefix` to that and keep the `claims`. Its `fdrl_…` ID
   goes in the workflow's `ANTHROPIC_FEDERATION_RULE_ID`.
5. **Issuer: Google**: name `google`, issuer URL
   `https://accounts.google.com`, JWKS: discovery.
6. **Rule: local runs via Google**. Get the unique ID first (step 3 of
   the local setup below):
   ```json
   {
     "name": "northtap-crawler-local-gcp",
     "match": {
       "audience": "https://api.anthropic.com",
       "claims": {
         "sub": "<service account uniqueId, e.g. 104892101234567890123>",
         "email": "northtap-crawler-local@<GCP_PROJECT>.iam.gserviceaccount.com"
       }
     },
     "target": { "type": "service_account", "service_account_id": "svac_…" },
     "workspace_id": "wrkspc_…",
     "oauth_scope": "workspace:developer",
     "token_lifetime_seconds": 600
   }
   ```
   Match `sub` exactly; never use a `subject_prefix` for Google tokens. Its
   `fdrl_…` ID is the local `ANTHROPIC_FEDERATION_RULE_ID`.

`workspace:developer` and 600 s are the wizard's defaults. The SDK refreshes
the access token automatically, so the short lifetime costs nothing. Two
rules mean CI and local access can be revoked independently.

### One-time local setup (Mac, Google Cloud)

Google signs identity tokens for a Google service account. Your own
`gcloud` login is allowed to mint them by impersonation, so no key file is
ever downloaded. The service account needs no Google Cloud roles; it only
exists as an identity.

```bash
# 1. Log in and pick (or create) a Google Cloud project
gcloud auth login
gcloud config set project <GCP_PROJECT>
gcloud services enable iamcredentials.googleapis.com

# 2. Create the identity and let your own account impersonate it
gcloud iam service-accounts create northtap-crawler-local \
  --display-name="NorthTap crawler (Claude WIF, local)"
gcloud iam service-accounts add-iam-policy-binding \
  northtap-crawler-local@<GCP_PROJECT>.iam.gserviceaccount.com \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/iam.serviceAccountTokenCreator"

# 3. Unique ID for the Console rule's claims.sub
gcloud iam service-accounts describe \
  northtap-crawler-local@<GCP_PROJECT>.iam.gserviceaccount.com \
  --format='value(uniqueId)'

# 4. Check gcloud can mint the token (IAM changes can take a minute)
gcloud auth print-identity-token \
  --impersonate-service-account=northtap-crawler-local@<GCP_PROJECT>.iam.gserviceaccount.com \
  --audiences=https://api.anthropic.com --include-email >/dev/null && echo ok
```

Then, after the Console setup, put this in `apps/crawler/.env.local`:

```bash
ANTHROPIC_ORGANIZATION_ID=<org uuid>
ANTHROPIC_SERVICE_ACCOUNT_ID=svac_…
ANTHROPIC_FEDERATION_RULE_ID=fdrl_…        # the local Google rule
CRAWLER_WIF_IDENTITY=gcloud
CRAWLER_WIF_GCP_SERVICE_ACCOUNT=northtap-crawler-local@<GCP_PROJECT>.iam.gserviceaccount.com
```

and run `pnpm --filter crawler auth:check`. Anyone else who should run the
crawler locally gets the same Token Creator binding (step 2). Removing it
revokes their access without touching the Console.

### GitHub Actions (later phase; no workflow in this PR)

```yaml
permissions:
  id-token: write   # lets the job request a GitHub OIDC token
  contents: read
jobs:
  crawl:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_ORGANIZATION_ID: ${{ vars.ANTHROPIC_ORGANIZATION_ID }}
      ANTHROPIC_SERVICE_ACCOUNT_ID: ${{ vars.ANTHROPIC_SERVICE_ACCOUNT_ID }}
      ANTHROPIC_FEDERATION_RULE_ID: ${{ vars.ANTHROPIC_FEDERATION_RULE_ID_GHA }}
      CRAWLER_WIF_IDENTITY: github-actions
```

The IDs are identifiers, not secrets, so repository variables are enough.
The crawler fetches a fresh GitHub OIDC token itself whenever the SDK needs
to re-exchange, so long runs outlive GitHub's roughly 5-minute token lifetime.

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
    pages), `card_findings`, and
    `discovered_card_urls`. Each run is also saved to
    `apps/crawler/output/<run-id>/`:
    - `compare/`: page text, links, picked card links
    - `pages/NN-slug.txt`: cleaned card page text
    - `extractions/NN-slug.json`: extraction, checks and diff
    - `summary.json`

    `new`, `changed` and `possibly_discontinued` findings are stored with
    `review_status = 'pending'` and appear in the admin Review queue.
    `unchanged` findings are stored as `'checked'` and never queued.
    `checked_at` records when each finding was diffed against `cards`, so the
    newest `checked_at` per `linked_card_id` is when that card was last checked.

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
