-- Snapshot of the NorthTap public schema after migrations (for quick reference).
-- Source of truth: supabase/migrations/. Regenerate mentally after adding migrations;
-- do not apply this file with the CLI (use migrations instead).

-- Future hooks (not built yet): spend tracking, bank linking, welcome-bonus tracking.

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

create index user_cards_user_id_idx on public.user_cards (user_id);

-- Trigger: auth.users insert -> public.profiles row (security definer handle_new_user).

alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;

-- Policies (authenticated only): own rows via auth.uid() = id / user_id
--   profiles: select, insert, update, delete
--   user_cards: select, insert, update, delete
