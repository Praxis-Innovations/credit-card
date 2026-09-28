-- Generated card illustrations (decision 2026-09-27, docs/data/ASSETS.md).
-- No real card art for now: every card shows our own neutral illustration,
-- stored in cards.image_url with rights 'generated' (no source URL; we made it).
-- Merchant brand and loyalty program logos keep the licensed / issuer_provided
-- only rule.

comment on type public.asset_rights_status is
  'licensed / issuer_provided = cleared third-party art; generated = our own card illustration; placeholder = no asset (clients render fallback); unknown = provenance not established, never served.';

alter table public.cards
  drop constraint if exists cards_image_provenance_check;
alter table public.cards
  add constraint cards_image_provenance_check check (
    image_url is null
    or (
      image_rights_status in ('licensed', 'issuer_provided')
      and nullif(btrim(image_alt), '') is not null
      and image_source_url is not null
    )
    or (
      image_rights_status = 'generated'
      and nullif(btrim(image_alt), '') is not null
    )
  );

comment on column public.cards.image_url is
  'Public card image URL (brand-assets bucket): licensed / issuer_provided art, or our generated illustration. Null → clients render a card-shaped placeholder.';
comment on column public.cards.image_source_url is
  'Where the asset / permission came from (press kit, partner portal, licence). Null for generated illustrations.';
comment on column public.cards.image_rights_status is
  'Basis for displaying image_url: licensed or issuer_provided (with source URL), or generated (our illustration).';
