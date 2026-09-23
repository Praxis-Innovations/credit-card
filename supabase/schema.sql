-- Snapshot of the NorthTap public schema after migrations (for quick reference).
-- Source of truth: supabase/migrations/. Regenerate mentally after adding migrations;
-- do not apply this file with the CLI (use migrations instead).

-- Future hooks (not built yet): spend tracking, bank linking, welcome-bonus tracking,
-- crawler promotion of pending/stale catalog rows.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

create table public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  added_at timestamptz not null default now(),
  constraint user_cards_user_id_card_id_key unique (user_id, card_id)
);

create type public.catalog_status as enum ('pending', 'verified', 'stale', 'rejected');
create type public.api_key_tier as enum ('internal', 'standard', 'elevated');

create table public.cards (
  id text primary key,
  name text not null,
  issuer text not null,
  annual_fee numeric not null,
  point_currency text not null,
  reward_categories jsonb not null,
  welcome_offer jsonb,
  network text,
  tier text,
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

create table public.loyalty_programs (
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

create table public.merchant_brands (
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

create table public.merchant_partnerships (
  id text primary key,
  brand_ids text[] not null,
  loyalty_program_id text references public.loyalty_programs (id),
  card_ids text[] not null,
  affiliation text not null,
  requirements text not null,
  benefits jsonb not null,
  stacks_with_card_category_rewards boolean not null default false,
  notes text,
  source_urls text[] not null,
  last_verified date not null,
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  status public.catalog_status not null default 'pending'
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_prefix text not null,
  owner_label text not null,
  tier public.api_key_tier not null default 'standard',
  rate_limit_per_minute integer not null default 60,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- RLS: profiles/user_cards = own rows; catalog = select verified for anon/authenticated;
-- api_keys = no client policies (service role only).
