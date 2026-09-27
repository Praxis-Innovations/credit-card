-- Card art, merchant brand logos and loyalty program logos
-- (on top of 20260923000000_catalog_and_api_keys.sql).
--
-- Every asset ships null with rights_status 'placeholder'. A URL may only be set
-- once someone has recorded where the image came from and on what basis we may
-- use it — see docs/data/ASSETS.md. Do not scrape or hotlink issuer / brand art.

-- ---------------------------------------------------------------------------
-- Rights status for a catalog image
-- ---------------------------------------------------------------------------
create type public.asset_rights_status as enum (
  'licensed',
  'issuer_provided',
  'placeholder',
  'unknown'
);

comment on type public.asset_rights_status is
  'licensed / issuer_provided = cleared for display; placeholder = no asset (clients render fallback); unknown = provenance not established, never served.';

-- ---------------------------------------------------------------------------
-- cards.image_*
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists image_url text,
  add column if not exists image_alt text,
  add column if not exists image_source_url text,
  add column if not exists image_rights_status public.asset_rights_status
    not null default 'placeholder',
  add column if not exists image_updated_at timestamptz,
  add column if not exists image_updated_by text;

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
  );

comment on column public.cards.image_url is
  'Public card-art URL (brand-assets bucket). Null → clients render a card-shaped placeholder.';
comment on column public.cards.image_alt is
  'Accessible description of the card art.';
comment on column public.cards.image_source_url is
  'Where the asset / permission came from (press kit, partner portal, licence).';
comment on column public.cards.image_rights_status is
  'Basis for displaying image_url. A URL requires licensed or issuer_provided.';
comment on column public.cards.image_updated_at is
  'When the image fields last changed (set by the assets admin script).';
comment on column public.cards.image_updated_by is
  'Who last changed the image fields (e.g. github:login).';

-- ---------------------------------------------------------------------------
-- merchant_brands.logo_*
-- ---------------------------------------------------------------------------
alter table public.merchant_brands
  add column if not exists logo_url text,
  add column if not exists logo_alt text,
  add column if not exists logo_source_url text,
  add column if not exists logo_rights_status public.asset_rights_status
    not null default 'placeholder',
  add column if not exists logo_updated_at timestamptz,
  add column if not exists logo_updated_by text;

alter table public.merchant_brands
  drop constraint if exists merchant_brands_logo_provenance_check;
alter table public.merchant_brands
  add constraint merchant_brands_logo_provenance_check check (
    logo_url is null
    or (
      logo_rights_status in ('licensed', 'issuer_provided')
      and nullif(btrim(logo_alt), '') is not null
      and logo_source_url is not null
    )
  );

comment on column public.merchant_brands.logo_url is
  'Public logo URL (brand-assets bucket). Null → clients render an initial-letter tile.';
comment on column public.merchant_brands.logo_alt is
  'Accessible description of the logo.';
comment on column public.merchant_brands.logo_source_url is
  'Where the asset / permission came from (brand guidelines, press kit, partner portal).';
comment on column public.merchant_brands.logo_rights_status is
  'Basis for displaying logo_url. A URL requires licensed or issuer_provided.';
comment on column public.merchant_brands.logo_updated_at is
  'When the logo fields last changed (set by the assets admin script).';
comment on column public.merchant_brands.logo_updated_by is
  'Who last changed the logo fields (e.g. github:login).';

-- ---------------------------------------------------------------------------
-- loyalty_programs.logo_*
-- ---------------------------------------------------------------------------
alter table public.loyalty_programs
  add column if not exists logo_url text,
  add column if not exists logo_alt text,
  add column if not exists logo_source_url text,
  add column if not exists logo_rights_status public.asset_rights_status
    not null default 'placeholder',
  add column if not exists logo_updated_at timestamptz,
  add column if not exists logo_updated_by text;

alter table public.loyalty_programs
  drop constraint if exists loyalty_programs_logo_provenance_check;
alter table public.loyalty_programs
  add constraint loyalty_programs_logo_provenance_check check (
    logo_url is null
    or (
      logo_rights_status in ('licensed', 'issuer_provided')
      and nullif(btrim(logo_alt), '') is not null
      and logo_source_url is not null
    )
  );

comment on column public.loyalty_programs.logo_url is
  'Public logo URL (brand-assets bucket). Null → clients render an initial-letter tile.';
comment on column public.loyalty_programs.logo_alt is
  'Accessible description of the logo.';
comment on column public.loyalty_programs.logo_source_url is
  'Where the asset / permission came from (brand guidelines, press kit, partner portal).';
comment on column public.loyalty_programs.logo_rights_status is
  'Basis for displaying logo_url. A URL requires licensed or issuer_provided.';
comment on column public.loyalty_programs.logo_updated_at is
  'When the logo fields last changed (set by the assets admin script).';
comment on column public.loyalty_programs.logo_updated_by is
  'Who last changed the logo fields (e.g. github:login).';

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for catalog images; writes are service-role only.
-- Raster formats only — SVG is excluded because it can carry script.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "brand_assets_public_read" on storage.objects;
create policy "brand_assets_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'brand-assets');

-- service_role already bypasses RLS; these make the intended writer explicit.
-- There are deliberately no insert/update/delete policies for anon/authenticated.
drop policy if exists "brand_assets_service_role_insert" on storage.objects;
create policy "brand_assets_service_role_insert"
  on storage.objects
  for insert
  to service_role
  with check (bucket_id = 'brand-assets');

drop policy if exists "brand_assets_service_role_update" on storage.objects;
create policy "brand_assets_service_role_update"
  on storage.objects
  for update
  to service_role
  using (bucket_id = 'brand-assets')
  with check (bucket_id = 'brand-assets');

drop policy if exists "brand_assets_service_role_delete" on storage.objects;
create policy "brand_assets_service_role_delete"
  on storage.objects
  for delete
  to service_role
  using (bucket_id = 'brand-assets');
