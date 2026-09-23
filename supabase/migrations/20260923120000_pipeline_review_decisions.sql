-- Pipeline review support on top of catalog_status tables
-- (20260923000000_catalog_and_api_keys.sql).

-- Reviewer identity on promoted / reviewed catalog rows
alter table public.cards
  add column if not exists reviewed_by text;

alter table public.loyalty_programs
  add column if not exists reviewed_by text;

alter table public.merchant_brands
  add column if not exists reviewed_by text;

alter table public.merchant_partnerships
  add column if not exists reviewed_by text;

comment on column public.cards.reviewed_by is
  'Reviewer identity (e.g. github:login) set on promote / reject / stale transitions.';
comment on column public.loyalty_programs.reviewed_by is
  'Reviewer identity set on promote / reject / stale transitions.';
comment on column public.merchant_brands.reviewed_by is
  'Reviewer identity set on promote / reject / stale transitions.';
comment on column public.merchant_partnerships.reviewed_by is
  'Reviewer identity set on promote / reject / stale transitions.';

-- Fingerprinted crawl candidates that were reviewed without (or before) a catalog row.
-- Diff skips re-flagging fingerprints with status=rejected.
create table if not exists public.pipeline_review_decisions (
  fingerprint text primary key,
  finding_kind text not null,
  issuer text,
  subject text,
  staging_value text,
  production_value text,
  status public.catalog_status not null
    check (status in ('pending', 'rejected', 'verified', 'stale')),
  reason text,
  reviewed_by text not null,
  reviewed_at timestamptz not null default now(),
  source_urls text[] not null default '{}',
  captured_at timestamptz not null default now()
);

comment on table public.pipeline_review_decisions is
  'Human decisions on staged crawl findings. Rejected fingerprints are suppressed on later diffs.';

create index if not exists pipeline_review_decisions_status_idx
  on public.pipeline_review_decisions (status);

alter table public.pipeline_review_decisions enable row level security;
-- No client policies — service role only (same pattern as api_keys).
