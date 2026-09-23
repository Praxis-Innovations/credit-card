-- NorthTap public catalog + API keys.
-- Catalog rows are publicly readable (verified only via API); writes are service-role only.
-- Crawler promotion into these tables is a future workstream.

-- ---------------------------------------------------------------------------
-- Shared audit / review status
-- ---------------------------------------------------------------------------
create type public.catalog_status as enum (
  'pending',
  'verified',
  'stale',
  'rejected'
);

create type public.api_key_tier as enum (
  'internal',
  'standard',
  'elevated'
);

-- ---------------------------------------------------------------------------
-- cards — mirrors apps/api/src/domain CreditCard
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id text primary key,
  name text not null,
  issuer text not null,
  annual_fee numeric not null check (annual_fee >= 0),
  point_currency text not null,
  reward_categories jsonb not null,
  welcome_offer jsonb,
  network text check (network is null or network in ('Visa', 'Mastercard', 'Amex')),
  tier text,
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

comment on table public.cards is
  'Credit card catalog. Shape mirrors apps/api/src/domain CreditCard; id is the stable slug.';

create index if not exists cards_issuer_idx on public.cards (issuer);
create index if not exists cards_point_currency_idx on public.cards (point_currency);
create index if not exists cards_status_idx on public.cards (status);

-- ---------------------------------------------------------------------------
-- loyalty_programs
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_programs (
  id text primary key,
  name text not null,
  description text,
  point_currency text,
  source_url text not null,
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

comment on table public.loyalty_programs is
  'Loyalty programs that sit between merchant brands and cards (Scene+, JOURNIE, etc.).';

create index if not exists loyalty_programs_status_idx
  on public.loyalty_programs (status);

-- ---------------------------------------------------------------------------
-- merchant_brands
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_brands (
  id text primary key,
  name text not null,
  category text not null,
  operator text,
  notes text,
  source_url text not null,
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

comment on table public.merchant_brands is
  'Merchant / retail brands participating in Canadian reward partnerships.';

create index if not exists merchant_brands_category_idx
  on public.merchant_brands (category);
create index if not exists merchant_brands_name_idx
  on public.merchant_brands (lower(name));
create index if not exists merchant_brands_status_idx
  on public.merchant_brands (status);

-- ---------------------------------------------------------------------------
-- merchant_partnerships
-- brand_ids is an array so multi-banner deals (Empire / Parkland) stay one row,
-- matching apps/api/src/domain MerchantPartnership.merchantBrandIds.
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_partnerships (
  id text primary key,
  brand_ids text[] not null check (cardinality(brand_ids) >= 1),
  loyalty_program_id text references public.loyalty_programs (id) on delete set null,
  card_ids text[] not null check (cardinality(card_ids) >= 1),
  affiliation text not null check (affiliation in ('linked', 'affiliated', 'direct')),
  requirements text not null,
  benefits jsonb not null,
  stacks_with_card_category_rewards boolean not null default false,
  notes text,
  source_urls text[] not null check (cardinality(source_urls) >= 1),
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

comment on table public.merchant_partnerships is
  'Cited merchant ↔ loyalty ↔ card partnerships. Public API serves status=verified only.';

create index if not exists merchant_partnerships_loyalty_idx
  on public.merchant_partnerships (loyalty_program_id);
create index if not exists merchant_partnerships_brand_ids_gin
  on public.merchant_partnerships using gin (brand_ids);
create index if not exists merchant_partnerships_card_ids_gin
  on public.merchant_partnerships using gin (card_ids);
create index if not exists merchant_partnerships_status_idx
  on public.merchant_partnerships (status);

-- ---------------------------------------------------------------------------
-- api_keys — hashed keys for the public HTTP API (apps/api)
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_prefix text not null,
  owner_label text not null,
  tier public.api_key_tier not null default 'standard',
  rate_limit_per_minute integer not null default 60
    check (rate_limit_per_minute > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.api_keys is
  'API key hashes for apps/api. Plaintext keys are never stored; only SHA-256 hashes.';

create index if not exists api_keys_hash_idx on public.api_keys (key_hash)
  where active = true;

-- ---------------------------------------------------------------------------
-- RLS: public read on verified catalog; no client writes. api_keys: no public access.
-- ---------------------------------------------------------------------------
alter table public.cards enable row level security;
alter table public.loyalty_programs enable row level security;
alter table public.merchant_brands enable row level security;
alter table public.merchant_partnerships enable row level security;
alter table public.api_keys enable row level security;

-- Catalog: anonymous + authenticated may SELECT verified rows only.
drop policy if exists "cards_select_verified" on public.cards;
create policy "cards_select_verified"
  on public.cards
  for select
  to anon, authenticated
  using (status = 'verified');

drop policy if exists "loyalty_programs_select_verified" on public.loyalty_programs;
create policy "loyalty_programs_select_verified"
  on public.loyalty_programs
  for select
  to anon, authenticated
  using (status = 'verified');

drop policy if exists "merchant_brands_select_verified" on public.merchant_brands;
create policy "merchant_brands_select_verified"
  on public.merchant_brands
  for select
  to anon, authenticated
  using (status = 'verified');

drop policy if exists "merchant_partnerships_select_verified" on public.merchant_partnerships;
create policy "merchant_partnerships_select_verified"
  on public.merchant_partnerships
  for select
  to anon, authenticated
  using (status = 'verified');

-- No INSERT/UPDATE/DELETE policies for clients — service role bypasses RLS.
-- api_keys: no policies → denied for anon/authenticated; service role only.
