# Catalog images: card art, store logos, program logos

The app design shows a card-art thumbnail on every card, a logo for each store,
and a small logo for each rewards program. The schema, API and admin tooling for
these exist, but **every asset currently ships empty** (`*_url = null`,
`*_rights_status = 'placeholder'`). How to get real images is an open decision for
the project owner; the options are below.

## Rights: why the images are empty

Issuer card art and store / program logos are trademarks and copyrighted
images. We do not own them, and a public catalog API redistributes whatever we
store. So:

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
| `cards` | `image_url`, `image_alt`, `image_source_url`, `image_rights_status`, `image_updated_at`, `image_updated_by` |
| `merchant_brands` | `logo_url`, `logo_alt`, `logo_source_url`, `logo_rights_status`, `logo_updated_at`, `logo_updated_by` |
| `loyalty_programs` | same `logo_*` columns |

`*_rights_status` (`public.asset_rights_status`):

| Value | Meaning | Served by the API? |
| --- | --- | --- |
| `placeholder` | No asset. Default for every row. | No (URL is null) |
| `unknown` | Provenance not established. | No |
| `licensed` | We hold a licence / partner agreement covering display. | Yes |
| `issuer_provided` | Supplied by the issuer or brand for this use (press kit, partner portal, written permission). | Yes |

Guardrails:

- A database check constraint only allows a non-null URL when the rights status
  is `licensed` or `issuer_provided` **and** alt text and a source URL are set.
- The API only returns a URL for those two statuses, even if one is stored.
- Files live in the public Storage bucket `brand-assets` (reads are public,
  writes are service-role only). PNG, JPEG or WebP only, 1 MiB max. SVG is
  refused because it can carry script.

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

## Sourcing options (not decided)

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
