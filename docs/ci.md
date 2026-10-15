# CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull
request, every push to `main`, merge-queue builds and manual dispatch.

## What runs

| Job | Command |
|-----|---------|
| `typecheck` | `pnpm turbo run typecheck` for api, admin, crawler, mobile, web |
| `lint` | `pnpm turbo run lint` for the same apps |
| `test` | `pnpm turbo run test` (Vitest unit tests) for the same apps |
| `api coverage` | `pnpm --filter api test:coverage` — prints a text report and uploads `coverage-summary.json` |
| `CI gate` | Fails unless every job above succeeded |

Each job installs with `pnpm install --frozen-lockfile` via the shared
[`setup` action](../.github/actions/setup/action.yml). The pnpm store is cached
by `actions/setup-node`, and turbo's local cache (`.turbo/cache`) is cached per
task with `actions/cache`, so packages whose inputs haven't changed replay
their previous result.

To reproduce locally:

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter api test:coverage
```

No secrets are needed; unit tests must not depend on network services or
`.env` files.

## Adding jobs

Later checks (code health, e2e) go in the same workflow as new jobs:

1. Start the job with `actions/checkout` and `uses: ./.github/actions/setup`
   (pick a unique `turbo-cache-key`).
2. Append the job id to `ci-gate.needs`.

Because branch protection only requires `CI gate`, the new job is blocking as
soon as it is in `needs`; no repo settings change.

## Making CI a required check

A repo admin does this once in GitHub (it is not configured from this repo):

1. Let the workflow run at least once (any PR) so the `CI gate` check exists.
2. **Settings → Branches → Add branch ruleset** (or **Add classic branch
   protection rule**) targeting `main`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass**, optionally **Require branches to
   be up to date before merging**, and add the check **`CI gate`**
   (source: GitHub Actions).
5. Save.

Equivalent with the GitHub CLI (classic protection; replaces any existing rule
on `main`):

```bash
gh api -X PUT repos/Praxis-Innovations/credit-card/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "checks": [{ "context": "CI gate" }] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
EOF
```
