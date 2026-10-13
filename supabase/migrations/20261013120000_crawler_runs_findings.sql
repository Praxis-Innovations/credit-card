-- NorthTap crawler (apps/crawler): one row per crawl run and one row per card
-- the run extracted (or per catalog card it could no longer find). The crawler
-- writes with the server-side key from its own environment (bypasses RLS);
-- the admin console reads these tables as the signed-in admin under the same
-- is_admin() policies as crawl_sources.

-- ---------------------------------------------------------------------------
-- crawl_runs
-- ---------------------------------------------------------------------------
create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  -- Null source_id = a run over several sources (source_scope says which).
  source_id uuid references public.crawl_sources (id) on delete set null,
  source_scope text not null check (length(btrim(source_scope)) between 1 and 200),
  trigger text not null default 'manual' check (trigger in ('manual', 'cli', 'schedule')),
  status text not null default 'requested'
    check (status in ('requested', 'running', 'done', 'failed')),
  model text,
  links_on_compare_page integer not null default 0 check (links_on_compare_page >= 0),
  cards_discovered integer not null default 0 check (cards_discovered >= 0),
  pages_fetched integer not null default 0 check (pages_fetched >= 0),
  pages_skipped integer not null default 0 check (pages_skipped >= 0),
  claude_calls integer not null default 0 check (claude_calls >= 0),
  hash_skips integer not null default 0 check (hash_skips >= 0),
  cards_extracted integer not null default 0 check (cards_extracted >= 0),
  flagged_values integer not null default 0 check (flagged_values >= 0),
  findings_new integer not null default 0 check (findings_new >= 0),
  findings_changed integer not null default 0 check (findings_changed >= 0),
  findings_unchanged integer not null default 0 check (findings_unchanged >= 0),
  findings_possibly_discontinued integer not null default 0
    check (findings_possibly_discontinued >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_estimate_usd numeric(10, 4) not null default 0 check (cost_estimate_usd >= 0),
  -- Hash of the compare page's cleaned text + the card links picked from it,
  -- so an unchanged compare page skips the Claude link-discovery call.
  compare_page_hash text,
  discovered_links jsonb check (discovered_links is null or jsonb_typeof(discovered_links) = 'array'),
  -- Pages logged and skipped: robots disallow, 403/429/CAPTCHA, errors.
  skipped jsonb not null default '[]'::jsonb check (jsonb_typeof(skipped) = 'array'),
  requested_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  constraint crawl_runs_finished_after_start
    check (finished_at is null or started_at is null or finished_at >= started_at),
  constraint crawl_runs_failed_has_error
    check (status <> 'failed' or error is not null)
);

comment on table public.crawl_runs is
  'One crawler run (apps/crawler). Written by the crawler''s server-side key; admins read and may request runs.';

create index if not exists crawl_runs_source_idx on public.crawl_runs (source_id, created_at desc);
create index if not exists crawl_runs_status_idx on public.crawl_runs (status)
  where status in ('requested', 'running');

-- ---------------------------------------------------------------------------
-- card_findings — what a run found for one card, awaiting human review
-- ---------------------------------------------------------------------------
create table if not exists public.card_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.crawl_runs (id) on delete cascade,
  source_id uuid not null references public.crawl_sources (id) on delete cascade,
  discovered_url_id uuid references public.discovered_card_urls (id) on delete set null,
  -- Null only for possibly_discontinued findings (no page was found).
  product_url text check (product_url is null or product_url ~ '^https?://'),
  card_name text,
  page_hash text,
  -- Fixed schema; every value carries a verbatim quote from the page.
  extracted jsonb,
  -- Deterministic checks: quote verbatim in page, value in quote, range.
  check_results jsonb,
  flagged_count integer not null default 0 check (flagged_count >= 0),
  diff_kind text check (diff_kind in ('new', 'changed', 'unchanged', 'possibly_discontinued')),
  diff jsonb,
  linked_card_id text references public.cards (id) on delete set null,
  reused_extraction boolean not null default false,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_estimate_usd numeric(10, 6) not null default 0 check (cost_estimate_usd >= 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'ignored')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint card_findings_page_or_discontinued
    check (product_url is not null or diff_kind = 'possibly_discontinued'),
  constraint card_findings_discontinued_links_card
    check (diff_kind is distinct from 'possibly_discontinued' or linked_card_id is not null)
);

comment on table public.card_findings is
  'Per-card crawler output (extraction + checks + diff vs cards). Never promoted to the catalog without review.';

create index if not exists card_findings_run_idx on public.card_findings (run_id);
create index if not exists card_findings_review_idx on public.card_findings (review_status, created_at desc);
-- Hash-skip lookup: latest extraction for a page.
create index if not exists card_findings_page_idx
  on public.card_findings (source_id, product_url, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants + RLS (same split as crawl_sources: console roles read, admins
-- write). Validators may only record a review decision on a finding.
-- ---------------------------------------------------------------------------
revoke all on table public.crawl_runs, public.card_findings from anon, authenticated;

grant select, insert, update, delete on table public.crawl_runs to authenticated;
grant select, insert, delete on table public.card_findings to authenticated;
grant update (review_status, reviewed_by, reviewed_at) on table public.card_findings to authenticated;

alter table public.crawl_runs enable row level security;
alter table public.card_findings enable row level security;

drop policy if exists crawl_runs_select on public.crawl_runs;
create policy crawl_runs_select on public.crawl_runs
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists crawl_runs_insert on public.crawl_runs;
create policy crawl_runs_insert on public.crawl_runs
  for insert to authenticated
  with check ((select public.is_admin('admin')) and status = 'requested');
drop policy if exists crawl_runs_update on public.crawl_runs;
create policy crawl_runs_update on public.crawl_runs
  for update to authenticated
  using ((select public.is_admin('admin'))) with check ((select public.is_admin('admin')));
drop policy if exists crawl_runs_delete on public.crawl_runs;
create policy crawl_runs_delete on public.crawl_runs
  for delete to authenticated using ((select public.is_admin('admin')));

drop policy if exists card_findings_select on public.card_findings;
create policy card_findings_select on public.card_findings
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists card_findings_insert on public.card_findings;
create policy card_findings_insert on public.card_findings
  for insert to authenticated with check ((select public.is_admin('admin')));
drop policy if exists card_findings_update on public.card_findings;
create policy card_findings_update on public.card_findings
  for update to authenticated
  using ((select public.is_admin('validator'))) with check ((select public.is_admin('validator')));
drop policy if exists card_findings_delete on public.card_findings;
create policy card_findings_delete on public.card_findings
  for delete to authenticated using ((select public.is_admin('admin')));
