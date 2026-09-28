-- Card art for dev / test (owner decision 2026-09-27, docs/data/ASSETS.md):
--   * image_url may hold issuer product-page art with rights 'unknown' (the API
--     hides it unless NORTHTAP_SERVE_UNLICENSED_ASSETS=true) or our own
--     'generated' render.
--   * image_fallback_url always holds the generated render, so the API has a
--     servable image for every card even when image_url is withheld.

alter table public.cards
  add column if not exists image_fallback_url text;

comment on column public.cards.image_fallback_url is
  'Generated neutral card render (brand-assets bucket). Served when image_url is null or not cleared for display.';

alter table public.cards
  drop constraint if exists cards_image_provenance_check;
alter table public.cards
  add constraint cards_image_provenance_check check (
    image_url is null
    or (
      image_rights_status in ('licensed', 'issuer_provided', 'unknown')
      and nullif(btrim(image_alt), '') is not null
      and image_source_url is not null
    )
    or (
      image_rights_status = 'generated'
      and nullif(btrim(image_alt), '') is not null
    )
  );

comment on column public.cards.image_rights_status is
  'Basis for displaying image_url. licensed / issuer_provided / generated are served; unknown only when NORTHTAP_SERVE_UNLICENSED_ASSETS=true.';
comment on column public.cards.image_source_url is
  'Where the asset / permission came from (press kit, licence, or the issuer product page it was fetched from). Null for generated renders.';
