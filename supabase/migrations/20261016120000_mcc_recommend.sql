-- MC1: MCC recommend machinery. Empty tables only — no seed / reference rows.
-- Live catalog rows stay pending until an admin approves merchant_code_findings.

-- ---------------------------------------------------------------------------
-- Enums / constrained vocabularies
-- ---------------------------------------------------------------------------
create type public.mcc_certainty as enum (
  'confirmed',
  'varies_by_store',
  'varies_by_network',
  'varies_by_product',
  'category_only',
  'estimate',
  'unknown'
);

create type public.mcc_network as enum (
  'visa',
  'mastercard',
  'amex',
  'visa_mc',
  'all'
);

create type public.mcc_channel as enum (
  'in_store',
  'online',
  'pay_at_pump'
);

create type public.merchant_code_source_type as enum (
  'issuer_merchant_list',
  'cardholder_report',
  'blog',
  'issuer_faq',
  'test_purchase'
);

create type public.merchant_code_finding_kind as enum (
  'store_code',
  'test_purchase',
  'mcc_code',
  'category_mcc',
  'store_type_mcc'
);

create type public.mcc_source as enum (
  'terms',
  'network_default'
);

-- Four-digit MCC text (ISO 18245). Used as PK / FK so Amex-only codes can sit
-- alongside Visa/MC without casting.
create domain public.mcc_code as text
  check (value ~ '^\d{4}$');

-- ---------------------------------------------------------------------------
-- mcc_codes — reference list (empty until findings are approved)
-- ---------------------------------------------------------------------------
create table if not exists public.mcc_codes (
  mcc public.mcc_code primary key,
  name text not null check (length(btrim(name)) between 1 and 200),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  status public.catalog_status not null default 'pending',
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  reviewed_by text,
  last_verified date
);

comment on table public.mcc_codes is
  'Merchant Category Codes. Empty in migrations; populated only via approved findings.';

create index if not exists mcc_codes_status_idx on public.mcc_codes (status);

-- ---------------------------------------------------------------------------
-- category_mccs — which MCCs belong to each display category (CATEGORIES)
-- ---------------------------------------------------------------------------
create table if not exists public.category_mccs (
  category text not null check (category in (
    'groceries', 'dining', 'gas', 'transit', 'drugstore',
    'recurring_bills', 'travel', 'foreign_currency', 'entertainment', 'other'
  )),
  mcc public.mcc_code not null references public.mcc_codes (mcc) on delete cascade,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  status public.catalog_status not null default 'pending',
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  reviewed_by text,
  primary key (category, mcc)
);

comment on table public.category_mccs is
  'Display-category ↔ MCC membership. CATEGORIES does not grow; new groups are rows here.';

create index if not exists category_mccs_mcc_idx on public.category_mccs (mcc);
create index if not exists category_mccs_status_idx on public.category_mccs (status);

-- ---------------------------------------------------------------------------
-- store_type_mccs — OSM tag → MCC estimate (fallback when brand code unknown)
-- ---------------------------------------------------------------------------
create table if not exists public.store_type_mccs (
  osm_tag text primary key check (length(btrim(osm_tag)) between 1 and 120),
  mcc public.mcc_code not null references public.mcc_codes (mcc) on delete restrict,
  note text,
  status public.catalog_status not null default 'pending',
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  reviewed_by text
);

comment on table public.store_type_mccs is
  'OpenStreetMap tag → MCC estimate used when no approved brand code exists.';

create index if not exists store_type_mccs_mcc_idx on public.store_type_mccs (mcc);
create index if not exists store_type_mccs_status_idx on public.store_type_mccs (status);

-- ---------------------------------------------------------------------------
-- merchant_brands — MCC fields (status already uses catalog_status)
-- ---------------------------------------------------------------------------
alter table public.merchant_brands
  add column if not exists mcc public.mcc_code
    references public.mcc_codes (mcc) on delete set null,
  add column if not exists amex_mcc public.mcc_code
    references public.mcc_codes (mcc) on delete set null,
  add column if not exists certainty public.mcc_certainty not null default 'unknown',
  add column if not exists accepted_networks text[]
    check (
      accepted_networks is null
      or (
        cardinality(accepted_networks) >= 1
        and accepted_networks <@ array['visa', 'mastercard', 'amex']::text[]
      )
    );

comment on column public.merchant_brands.mcc is
  'Approved Visa/Mastercard MCC for this chain, or null until reviewed.';
comment on column public.merchant_brands.amex_mcc is
  'Optional Amex-specific MCC when it differs from mcc.';
comment on column public.merchant_brands.certainty is
  'How sure we are of the store code (confirmed … unknown).';
comment on column public.merchant_brands.accepted_networks is
  'Networks this chain accepts in-store. Null = unknown (do not block).';

create index if not exists merchant_brands_mcc_idx on public.merchant_brands (mcc);
create index if not exists merchant_brands_amex_mcc_idx on public.merchant_brands (amex_mcc);

-- ---------------------------------------------------------------------------
-- Earn-rule fields on cards.reward_categories jsonb (documented shape).
-- Keys are camelCase to match apps/api domain RewardCategory / mapCard passthrough
-- (same convention as earnRate, capMonthly). Each element MAY include, in
-- addition to category / earnRate / caps:
--   mccs text[], merchants text[], mccSource ('terms'|'network_default'),
--   exclusions text[], capGroup text, rateAfterCap number,
--   tierThreshold number, validFrom date, validTo date,
--   quote text, sourceUrl text, userChosen boolean
-- Live values are applied only after review; importers write findings only.
-- ---------------------------------------------------------------------------
comment on column public.cards.reward_categories is
  'Earn rules (jsonb array). Optional MCC fields (camelCase): mccs, merchants, '
  'mccSource, exclusions, capGroup, rateAfterCap, tierThreshold, validFrom, '
  'validTo, quote, sourceUrl, userChosen. Applied only after human review.';

-- ---------------------------------------------------------------------------
-- merchant_code_evidence — cited observations backing a chain's code
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_code_evidence (
  id uuid primary key default gen_random_uuid(),
  merchant_brand_id text references public.merchant_brands (id) on delete set null,
  chain text not null check (length(btrim(chain)) between 1 and 200),
  mcc public.mcc_code,
  network public.mcc_network not null default 'all',
  channel public.mcc_channel not null default 'in_store',
  source_type public.merchant_code_source_type not null,
  url text check (url is null or url ~ '^https?://'),
  quote text,
  observed_date date,
  -- test_purchase fields (statement line is source of truth; location/format derived)
  statement_text text,
  location text,
  format text,
  store_number text,
  city text,
  card_id text references public.cards (id) on delete set null,
  screenshot_path text,
  mcc_shown public.mcc_code,
  category_shown text,
  created_at timestamptz not null default now(),
  constraint merchant_code_evidence_has_cite
    check (
      source_type = 'test_purchase'
      or (url is not null and quote is not null and observed_date is not null)
    ),
  constraint merchant_code_evidence_test_purchase
    check (
      source_type <> 'test_purchase'
      or (
        statement_text is not null
        and length(btrim(statement_text)) > 0
        and observed_date is not null
      )
    )
);

comment on table public.merchant_code_evidence is
  'Cited chain→MCC evidence (issuer lists, reports, blogs, FAQs, test purchases).';

create index if not exists merchant_code_evidence_brand_idx
  on public.merchant_code_evidence (merchant_brand_id);
create index if not exists merchant_code_evidence_chain_idx
  on public.merchant_code_evidence (lower(chain));

-- ---------------------------------------------------------------------------
-- merchant_code_findings — proposed changes awaiting review (like card_findings)
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_code_findings (
  id uuid primary key default gen_random_uuid(),
  kind public.merchant_code_finding_kind not null,
  -- Idempotency key: store_code = chain|url|network|channel;
  -- test_purchase = date|card|statement_text; others = natural key of the row.
  idempotency_key text not null,
  proposed jsonb not null check (jsonb_typeof(proposed) = 'object'),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected', 'ignored')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_code_findings_idempotency unique (kind, idempotency_key),
  constraint merchant_code_findings_rejected_has_note
    check (review_status <> 'rejected' or (review_note is not null and length(btrim(review_note)) > 0))
);

comment on table public.merchant_code_findings is
  'Proposed MCC / store-code / category-map changes. Importers write here only; never live rows.';

create index if not exists merchant_code_findings_review_idx
  on public.merchant_code_findings (review_status, created_at desc);
create index if not exists merchant_code_findings_kind_idx
  on public.merchant_code_findings (kind, created_at desc);

create or replace function public.merchant_code_findings_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists merchant_code_findings_touch on public.merchant_code_findings;
create trigger merchant_code_findings_touch
  before update on public.merchant_code_findings
  for each row execute function public.merchant_code_findings_touch_updated();

-- ---------------------------------------------------------------------------
-- RLS: public read of verified reference rows; findings/evidence admin-only
-- ---------------------------------------------------------------------------
alter table public.mcc_codes enable row level security;
alter table public.category_mccs enable row level security;
alter table public.store_type_mccs enable row level security;
alter table public.merchant_code_evidence enable row level security;
alter table public.merchant_code_findings enable row level security;

revoke all on table
  public.mcc_codes,
  public.category_mccs,
  public.store_type_mccs,
  public.merchant_code_evidence,
  public.merchant_code_findings
from anon, authenticated;

-- Verified reference data is publicly readable (same pattern as catalog).
grant select on table public.mcc_codes, public.category_mccs, public.store_type_mccs
  to anon, authenticated;

drop policy if exists mcc_codes_select_verified on public.mcc_codes;
create policy mcc_codes_select_verified on public.mcc_codes
  for select to anon, authenticated using (status = 'verified');

drop policy if exists category_mccs_select_verified on public.category_mccs;
create policy category_mccs_select_verified on public.category_mccs
  for select to anon, authenticated using (status = 'verified');

drop policy if exists store_type_mccs_select_verified on public.store_type_mccs;
create policy store_type_mccs_select_verified on public.store_type_mccs
  for select to anon, authenticated using (status = 'verified');

-- Admin console: viewers read; admins write findings/evidence; validators review.
grant select on table
  public.mcc_codes,
  public.category_mccs,
  public.store_type_mccs,
  public.merchant_code_evidence,
  public.merchant_code_findings
to authenticated;

grant insert, update, delete on table
  public.mcc_codes,
  public.category_mccs,
  public.store_type_mccs,
  public.merchant_code_evidence
to authenticated;

grant insert, delete on table public.merchant_code_findings to authenticated;
grant update (
  review_status, review_note, reviewed_by, reviewed_at, proposed, updated_at
) on table public.merchant_code_findings to authenticated;

drop policy if exists mcc_codes_admin_all on public.mcc_codes;
create policy mcc_codes_admin_all on public.mcc_codes
  for all to authenticated
  using ((select public.is_admin('admin')))
  with check ((select public.is_admin('admin')));

drop policy if exists mcc_codes_admin_select on public.mcc_codes;
create policy mcc_codes_admin_select on public.mcc_codes
  for select to authenticated using ((select public.is_admin('viewer')));

drop policy if exists category_mccs_admin_all on public.category_mccs;
create policy category_mccs_admin_all on public.category_mccs
  for all to authenticated
  using ((select public.is_admin('admin')))
  with check ((select public.is_admin('admin')));

drop policy if exists category_mccs_admin_select on public.category_mccs;
create policy category_mccs_admin_select on public.category_mccs
  for select to authenticated using ((select public.is_admin('viewer')));

drop policy if exists store_type_mccs_admin_all on public.store_type_mccs;
create policy store_type_mccs_admin_all on public.store_type_mccs
  for all to authenticated
  using ((select public.is_admin('admin')))
  with check ((select public.is_admin('admin')));

drop policy if exists store_type_mccs_admin_select on public.store_type_mccs;
create policy store_type_mccs_admin_select on public.store_type_mccs
  for select to authenticated using ((select public.is_admin('viewer')));

drop policy if exists merchant_code_evidence_select on public.merchant_code_evidence;
create policy merchant_code_evidence_select on public.merchant_code_evidence
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists merchant_code_evidence_write on public.merchant_code_evidence;
create policy merchant_code_evidence_write on public.merchant_code_evidence
  for all to authenticated
  using ((select public.is_admin('admin')))
  with check ((select public.is_admin('admin')));

drop policy if exists merchant_code_findings_select on public.merchant_code_findings;
create policy merchant_code_findings_select on public.merchant_code_findings
  for select to authenticated using ((select public.is_admin('viewer')));
drop policy if exists merchant_code_findings_insert on public.merchant_code_findings;
create policy merchant_code_findings_insert on public.merchant_code_findings
  for insert to authenticated with check ((select public.is_admin('admin')));
drop policy if exists merchant_code_findings_update on public.merchant_code_findings;
create policy merchant_code_findings_update on public.merchant_code_findings
  for update to authenticated
  using ((select public.is_admin('validator')))
  with check ((select public.is_admin('validator')));
drop policy if exists merchant_code_findings_delete on public.merchant_code_findings;
create policy merchant_code_findings_delete on public.merchant_code_findings
  for delete to authenticated using ((select public.is_admin('admin')));
