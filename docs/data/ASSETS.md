# Catalog images: card art, store logos, program logos

The app design shows a card-art thumbnail on every card, a logo for each store,
and a small logo for each rewards program. The schema, API and admin tooling for
these exist. Store and program logos still ship empty (`*_url = null`,
`*_rights_status = 'placeholder'`). Cards get dev / test art under the owner
decision below, plus a generated neutral render for every card.

## Owner decision, 2026-09-27: issuer product-page card art for dev / test

- **Decision:** for development and testing, card art may be sourced from each
  issuer's own public product page by `pnpm --filter api assets:fetch-card-art`.
  This overrides the "do not scrape" rule below **for card art, for dev / test
  use only**.
- **Date:** 2026-09-27. **Decided by:** the project owner.
- **Scope:** dev / test environments. Fetched art is stored with
  `image_rights_status = 'unknown'` and `image_source_url` = the product page.
  The API serves it only when `NORTHTAP_SERVE_UNLICENSED_ASSETS=true`, which
  must stay unset (false) in production.
- **Before public launch:** licensed images are still required. Replace every
  `unknown` row with `licensed` / `issuer_provided` art (see the sourcing
  options below), or leave the card on its generated render.
- **Limits:** issuer domains only (the reviewed mapping in
  `apps/api/src/assets/card-art/product-pages.ts`); never comparison sites,
  search engines or unrelated image CDNs; robots.txt and the pipeline's per-host
  delay apply. Store and program logos are **not** covered.

## Rights: why the other images are empty

Issuer card art and store / program logos are trademarks and copyrighted
images. We do not own them, and a public catalog API redistributes whatever we
store. So, apart from the dev / test card-art decision above:

- **Do not** scrape, hotlink or bulk-download card art or logos from issuer,
  merchant or program websites, from search results or from other comparison
  sites.
- Only upload an image once you can say where it came from and why we're
  allowed to use it, and record that in `*_source_url` and `*_rights_status`.
- If permission is withdrawn or unclear, clear the asset (below). Clients fall
  back to the placeholder automatically.

## Data model

| Table | Columns |
| --- | --- |
| `cards` | `image_url`, `image_alt`, `image_source_url`, `image_rights_status`, `image_updated_at`, `image_updated_by`, `image_fallback_url` |
| `merchant_brands` | `logo_url`, `logo_alt`, `logo_source_url`, `logo_rights_status`, `logo_updated_at`, `logo_updated_by` |
| `loyalty_programs` | same `logo_*` columns |

`*_rights_status` (`public.asset_rights_status`):

| Value | Meaning | Served by the API? |
| --- | --- | --- |
| `placeholder` | No asset. Default for every row. | No (URL is null) |
| `unknown` | Provenance not established (e.g. issuer product-page art fetched for dev / test). | Only when `NORTHTAP_SERVE_UNLICENSED_ASSETS=true` |
| `licensed` | We hold a licence / partner agreement covering display. | Yes |
| `issuer_provided` | Supplied by the issuer or brand for this use (press kit, partner portal, written permission). | Yes |
| `generated` | Our own neutral card render (no issuer art). | Yes |

Guardrails:

- A database check constraint only allows a non-null URL when alt text is set
  and the rights status is `licensed` or `issuer_provided` with a source URL.
  For `cards` it also allows `unknown` (with a source URL) and `generated`.
- The API serves `licensed`, `issuer_provided` and `generated` URLs. It serves
  `unknown` only when `NORTHTAP_SERVE_UNLICENSED_ASSETS=true` (default false;
  `apps/api/.env.example` sets it to true for local dev). Leave it unset in
  production.
- When a card's `image_url` is withheld (or empty) the API returns
  `image_fallback_url`, the generated render, so a card is never blank.
  `imageAlt` then describes the illustration ("… card (illustration)").
- Files live in the public Storage bucket `brand-assets` (reads are public,
  writes are service-role only). PNG, JPEG or WebP only, 1 MiB max. SVG is
  refused because it can carry script, so generated renders are rasterised to
  PNG before upload.

## API surface

- Cards: `imageUrl`, `imageAlt` on `GET /v1/cards`, `GET /v1/cards/:id` and on
  `recommendations[].card` in `POST /v1/recommendations`.
- Brands / programs: `logoUrl`, `logoAlt` on `/v1/merchant-brands(/:id)` and
  `/v1/loyalty-programs(/:id)`.
- Nested `{ id, name, logoUrl, logoAlt }` summaries: `brands[]` and
  `loyaltyProgram` on partnerships; `purchase.merchantBrand`,
  `recommendations[].merchantBrand` and `recommendations[].loyaltyProgram`
  on recommendations.

The static-catalog mode (`NORTHTAP_CATALOG_SOURCE=static`) has no assets and
always returns nulls.

## Card art fetcher (dev / test)

```bash
# Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Writes a report to
# apps/api/src/assets/card-art/reports/latest.{md,json}.
pnpm --filter api assets:fetch-card-art                  # all cards
pnpm --filter api assets:fetch-card-art --only amex-cobalt,td-aeroplan-vi
pnpm --filter api assets:fetch-card-art --dry-run        # fetch + select, no writes
pnpm --filter api assets:fetch-card-art --no-fetch       # generated renders only
pnpm --filter api assets:contact-sheet ./card-art.jpg    # grid of every card's stored image
```

For each card it:

1. Renders the generated fallback (issuer tone from a fixed palette that avoids
   the issuer's own brand colours, card name, issuer, network as plain text, a
   simple chip, an "Illustration" label), rasterises it to PNG and stores it in
   `image_fallback_url` (`cards/generated/<id>-<hash>.png`).
2. Fetches the product page listed in `card-art/product-pages.ts` with the
   pipeline's robots.txt check, per-host delay and User-Agent. Each page is
   fetched at most once per run.
3. Ranks the page's images (`img`, `srcset`, `data-*` image attributes,
   `og:image`, preloads, inline JSON): a reviewed `hint`, card-art paths, alt
   text that names the card, and card-name words in the file name score
   highest; badges, awards, logos and icons are rejected outright; banners /
   hero / lifestyle images are heavily penalised; art for the issuer's other
   cards is penalised. Only issuer hosts count.
   - Some issuers leave a card's own art out of its page but show it in a
     "related cards" carousel on their other product pages. Images on the
     issuer's other mapped pages are also considered, but only when their alt
     text names this card and isn't extended by another card's word ("Business
     Gold Rewards Card" does not name "Gold Rewards").
   - A reviewed `artUrl` (issuer host only) covers pages that render their art
     client-side (Amex Gold and Green).
4. Downloads the best candidates (revalidating cached copies with ETag /
   Last-Modified, so unchanged files aren't downloaded again), crops margins
   and drop shadows, turns vertical card designs to landscape, and keeps the
   best image close to the 1.586 : 1 card ratio (±5 %) and at least
   200 × 120 px. It is stored as a 640 px PNG with rights `unknown`, alt
   `<issuer> <card name> card` and `image_source_url` = the issuer page the
   image was found on.
5. If no art is found, `image_url` is set to the generated render with rights
   `generated`. Art fetched on an earlier run is kept if the failure looks
   transient (network error, 429, 5xx). `licensed` / `issuer_provided` rows are
   never touched.

Re-running is idempotent: object paths are content-hashed, and a row is only
updated when its URL or metadata would change. The download cache lives in
`apps/api/.cache/card-art/` (gitignored — it holds issuer images).

## Client fallback when a URL is null

Clients must treat `null` as normal, not as an error, and render:

- **Card:** a card-shaped tile at the ID-1 aspect ratio (85.60 × 53.98 mm,
  about 1.586 : 1) with rounded corners, a neutral background (it must not
  imitate the issuer's colours or design), and the issuer plus card name as
  text, e.g. "Scotiabank · Scene+ Visa".
- **Store or program:** a square or circular tile showing the first letter or
  digit of `name`, uppercased, on a neutral background. Pick the colour
  deterministically from `id` so a brand looks the same everywhere.
- **Accessibility:** use `imageAlt` / `logoAlt` when present, otherwise the
  card, store or program name.
- If an image fails to load, show the same placeholder.

## Admin script

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment (never
commit them).

```bash
# kind: card | merchant-brand | loyalty-program
pnpm --filter api assets:upload card scotia-scene-vi ./scene-visa.webp \
  --alt "Scotiabank Scene+ Visa card" \
  --source-url https://example.com/where-permission-is-documented \
  --rights issuer_provided \
  --by github:<login>

# Revert to placeholder and delete the stored object
pnpm --filter api assets:clear card scotia-scene-vi --by github:<login>
```

Add `--dry-run` to validate the file and print the planned upload and row
update without touching Supabase. The script checks the file's type from its
bytes, stores it under a content-hashed path (`cards/<id>-<hash>.webp`) so CDN
caches never serve a stale image, sets the URL and metadata on the row, and
deletes the object it replaced.

## Sourcing options for launch (not decided)

These are options for the project owner to weigh. Each has different terms, and
legal review is advisable before relying on any of them.

1. **Issuer and brand press kits / media centres.** Many banks, retailers and
   loyalty programs publish logos and product images for media use. The terms
   are often limited to editorial use, and a commercial app may not qualify.
   Read the terms for each asset.
2. **Partner or affiliate programs.** Card-comparison affiliate and partner
   programs often supply approved card art and logos to participants, under
   the program agreement. This usually brings disclosure and placement
   obligations, and may affect how recommendations have to be presented.
3. **Direct written permission.** Ask the issuer, merchant or program for
   permission to display their card art or logo in the app. Keep the
   correspondence and link or reference it in `*_source_url`.
4. **Brand guidelines for logo use.** Where a brand publishes logo usage
   guidelines, follow them: approved files only, no recolouring or distortion,
   clear space and minimum size, and nothing that implies endorsement or
   partnership. Guidelines describe how to use a logo; they are not a licence by
   themselves.
5. **Stay with placeholders.** The app works without any images. Neutral
   placeholders have no rights exposure and can be kept for some or all rows.

Whichever route is chosen, record the basis per asset: `*_rights_status`,
`*_source_url` and the uploader in `*_updated_by`.
