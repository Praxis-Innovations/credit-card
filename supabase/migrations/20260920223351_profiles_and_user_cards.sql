-- NorthTap MVP: auth profiles + owned credit cards.
-- Future hooks (not built yet): spend tracking, bank linking, welcome-bonus tracking.

-- ---------------------------------------------------------------------------
-- profiles: public row per auth.users account
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text
);

comment on table public.profiles is 'Public profile for each Supabase Auth user.';

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- user_cards: which card slugs a user owns (catalog lives in packages/core)
-- ---------------------------------------------------------------------------
create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  added_at timestamptz not null default now(),
  constraint user_cards_user_id_card_id_key unique (user_id, card_id)
);

comment on table public.user_cards is
  'Cards owned by a user. card_id is a frontend catalog slug (e.g. amex-cobalt), not a DB FK.';

create index if not exists user_cards_user_id_idx on public.user_cards (user_id);

-- ---------------------------------------------------------------------------
-- RLS: deny by default; explicit allow for own rows only
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- user_cards policies
drop policy if exists "user_cards_select_own" on public.user_cards;
create policy "user_cards_select_own"
  on public.user_cards
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_cards_insert_own" on public.user_cards;
create policy "user_cards_insert_own"
  on public.user_cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_cards_update_own" on public.user_cards;
create policy "user_cards_update_own"
  on public.user_cards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_cards_delete_own" on public.user_cards;
create policy "user_cards_delete_own"
  on public.user_cards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated role needs table privileges; RLS still restricts to own rows.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_cards to authenticated;
