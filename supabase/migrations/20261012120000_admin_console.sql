-- NorthTap admin console: Google admin allow-list, audit log, and the crawl
-- source list. Every table is admin-only under RLS: anon has no grants, and an
-- authenticated app user who is not on the allow-list sees zero rows and
-- cannot write. The admin app uses the signed-in user's JWT, never the
-- service role.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- admin_users — the allow-list
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  email extensions.citext primary key,
  role text not null check (role in ('admin', 'validator', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Admin console allow-list. Roles rank viewer < validator < admin.';

insert into public.admin_users (email, role, active)
values ('info.praxisinnovations@gmail.com', 'admin', true)
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Role checks. SECURITY DEFINER so policies can read admin_users without
-- granting app users access to it. The email comes from the verified JWT and
-- only counts when the user has a linked Google identity (app_metadata is
-- server-controlled), so an unconfirmed email/password signup that claims an
-- admin's address does not match.
-- ---------------------------------------------------------------------------
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select au.role
  from public.admin_users au
  where au.active
    and lower(au.email::text) = lower(nullif(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
  limit 1
$$;

create or replace function public.is_admin(min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      case public.current_admin_role()
        when 'admin' then 3 when 'validator' then 2 when 'viewer' then 1
      end
    ) >= (
      case min_role
        when 'admin' then 3 when 'validator' then 2 when 'viewer' then 1
      end
    ),
    false
  )
$$;

revoke all on function public.current_admin_role() from public, anon;
revoke all on function public.is_admin(text) from public, anon;
grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.is_admin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_audit — append-only; rows come from triggers, never from clients
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  before jsonb,
  after jsonb
);

create index if not exists admin_audit_entity_idx
  on public.admin_audit (entity, entity_id, at desc);

-- ---------------------------------------------------------------------------
-- crawl_sources — one row per issuer compare page
-- ---------------------------------------------------------------------------
create table if not exists public.crawl_sources (
  id uuid primary key default gen_random_uuid(),
  issuer_name extensions.citext not null unique
    check (length(btrim(issuer_name::text)) between 1 and 80),
  compare_url text check (compare_url is null or compare_url ~ '^https://'),
  url_pattern text,
  schedule text not null default 'monthly' check (schedule in ('monthly', 'manual')),
  status text not null default 'not_set_up'
    check (status in ('active', 'paused', 'not_set_up', 'blocked')),
  robots_status text check (robots_status in ('allowed', 'disallowed', 'unreachable')),
  robots_checked_at timestamptz,
  last_crawled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crawl_sources_active_needs_url
    check (status <> 'active' or compare_url is not null)
);

comment on table public.crawl_sources is
  'Admin-managed scrape list: each issuer''s official compare page.';

-- ---------------------------------------------------------------------------
-- discovered_card_urls — card pages the crawler finds on a compare page
-- ---------------------------------------------------------------------------
create table if not exists public.discovered_card_urls (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.crawl_sources (id) on delete cascade,
  card_name text not null,
  product_url text not null check (product_url ~ '^https://'),
  first_seen_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  http_status integer,
  linked_card_id text references public.cards (id) on delete set null,
  included boolean not null default true,
  unique (source_id, product_url)
);

create index if not exists discovered_card_urls_source_idx
  on public.discovered_card_urls (source_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists crawl_sources_set_updated_at on public.crawl_sources;
create trigger crawl_sources_set_updated_at
  before update on public.crawl_sources
  for each row execute function public.set_updated_at();

create or replace function public.audit_crawl_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_ignored text[] := array['robots_status', 'robots_checked_at', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    v_action := 'source.create';
  elsif tg_op = 'DELETE' then
    v_action := 'source.delete';
  elsif new.status = 'paused' and old.status <> 'paused' then
    v_action := 'source.pause';
  elsif old.status = 'paused' and new.status <> 'paused' then
    v_action := 'source.resume';
  elsif (to_jsonb(new) - v_ignored) = (to_jsonb(old) - v_ignored) then
    v_action := 'source.robots_check';
  else
    v_action := 'source.update';
  end if;

  insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
  values (
    coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user),
    v_action,
    'crawl_sources',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end
$$;

revoke all on function public.audit_crawl_source() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: start the scrape list with Scotiabank only; admins add other issuers
-- from the console. Inserted before the audit trigger so the log starts with
-- human actions.
-- ---------------------------------------------------------------------------
insert into public.crawl_sources (issuer_name, compare_url, url_pattern, schedule, status, notes)
values
  ('Scotiabank', 'https://www.scotiabank.com/ca/en/personal/credit-cards/compare-cards.html',
    '/credit-cards/', 'monthly', 'active', null)
on conflict (issuer_name) do nothing;

drop trigger if exists crawl_sources_audit on public.crawl_sources;
create trigger crawl_sources_audit
  after insert or update or delete on public.crawl_sources
  for each row execute function public.audit_crawl_source();

-- ---------------------------------------------------------------------------
-- Grants + RLS. Supabase grants new public tables to anon/authenticated by
-- default, so reset both explicitly.
-- ---------------------------------------------------------------------------
revoke all on table public.admin_users, public.admin_audit,
  public.crawl_sources, public.discovered_card_urls from anon, authenticated;

grant select, insert, update, delete on table public.admin_users,
  public.crawl_sources, public.discovered_card_urls to authenticated;
grant select on table public.admin_audit to authenticated;

alter table public.admin_users enable row level security;
alter table public.admin_audit enable row level security;
alter table public.crawl_sources enable row level security;
alter table public.discovered_card_urls enable row level security;

-- admin_users: any active admin-console user may read; only admins manage it.
drop policy if exists admin_users_select on public.admin_users;
create policy admin_users_select on public.admin_users
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists admin_users_insert on public.admin_users;
create policy admin_users_insert on public.admin_users
  for insert to authenticated with check ((select public.is_admin('admin')));
drop policy if exists admin_users_update on public.admin_users;
create policy admin_users_update on public.admin_users
  for update to authenticated
  using ((select public.is_admin('admin'))) with check ((select public.is_admin('admin')));
drop policy if exists admin_users_delete on public.admin_users;
create policy admin_users_delete on public.admin_users
  for delete to authenticated using ((select public.is_admin('admin')));

-- admin_audit: admins read; nobody writes through the API.
drop policy if exists admin_audit_select on public.admin_audit;
create policy admin_audit_select on public.admin_audit
  for select to authenticated using ((select public.is_admin('admin')));

-- crawl_sources: any console role reads; only admins edit.
drop policy if exists crawl_sources_select on public.crawl_sources;
create policy crawl_sources_select on public.crawl_sources
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists crawl_sources_insert on public.crawl_sources;
create policy crawl_sources_insert on public.crawl_sources
  for insert to authenticated with check ((select public.is_admin('admin')));
drop policy if exists crawl_sources_update on public.crawl_sources;
create policy crawl_sources_update on public.crawl_sources
  for update to authenticated
  using ((select public.is_admin('admin'))) with check ((select public.is_admin('admin')));
drop policy if exists crawl_sources_delete on public.crawl_sources;
create policy crawl_sources_delete on public.crawl_sources
  for delete to authenticated using ((select public.is_admin('admin')));

-- discovered_card_urls: same split as crawl_sources.
drop policy if exists discovered_card_urls_select on public.discovered_card_urls;
create policy discovered_card_urls_select on public.discovered_card_urls
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists discovered_card_urls_insert on public.discovered_card_urls;
create policy discovered_card_urls_insert on public.discovered_card_urls
  for insert to authenticated with check ((select public.is_admin('admin')));
drop policy if exists discovered_card_urls_update on public.discovered_card_urls;
create policy discovered_card_urls_update on public.discovered_card_urls
  for update to authenticated
  using ((select public.is_admin('admin'))) with check ((select public.is_admin('admin')));
drop policy if exists discovered_card_urls_delete on public.discovered_card_urls;
create policy discovered_card_urls_delete on public.discovered_card_urls
  for delete to authenticated using ((select public.is_admin('admin')));
