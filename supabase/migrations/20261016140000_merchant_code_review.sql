-- AD6: merchant-code findings in the review queue.
-- Approving a finding writes evidence + the chain's code/status in the same
-- transaction (no promote step). Verified requires 2 independent agreeing
-- sources; conflicting MCC evidence sets status to conflict.

-- ---------------------------------------------------------------------------
-- catalog_status: Conflict (DS10 Merchants board)
-- ---------------------------------------------------------------------------
alter type public.catalog_status add value if not exists 'conflict';

-- ---------------------------------------------------------------------------
-- Stamp + audit review decisions on merchant_code_findings (mirrors cards)
-- ---------------------------------------------------------------------------
create or replace function public.stamp_merchant_code_finding_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_email text := nullif(auth.jwt() ->> 'email', '');
begin
  if new.review_status is distinct from old.review_status and v_email is not null then
    new.reviewed_by := v_email;
    new.reviewed_at := now();
  end if;
  return new;
end
$$;

drop trigger if exists merchant_code_findings_stamp_review on public.merchant_code_findings;
create trigger merchant_code_findings_stamp_review
  before update on public.merchant_code_findings
  for each row execute function public.stamp_merchant_code_finding_review();

create or replace function public.audit_merchant_code_finding_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_status is distinct from old.review_status then
    insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
    values (
      coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user),
      'merchant_code_finding.' || case new.review_status
        when 'approved' then 'approve'
        when 'rejected' then 'reject'
        else new.review_status
      end,
      'merchant_code_findings',
      new.id::text,
      jsonb_build_object('review_status', old.review_status),
      jsonb_build_object(
        'review_status', new.review_status,
        'review_note', new.review_note,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at,
        'kind', new.kind,
        'idempotency_key', new.idempotency_key,
        'proposed', new.proposed
      )
    );
  end if;
  return new;
end
$$;

revoke all on function public.stamp_merchant_code_finding_review() from public, anon, authenticated;
revoke all on function public.audit_merchant_code_finding_review() from public, anon, authenticated;

drop trigger if exists merchant_code_findings_audit_review on public.merchant_code_findings;
create trigger merchant_code_findings_audit_review
  after update on public.merchant_code_findings
  for each row execute function public.audit_merchant_code_finding_review();

-- Validators decide pending → approved|rejected (also done via SECURITY DEFINER RPCs).
-- Admins may upsert proposed payloads (re-import), including resetting status to pending.
drop policy if exists merchant_code_findings_update on public.merchant_code_findings;
create policy merchant_code_findings_update on public.merchant_code_findings
  for update to authenticated
  using (
    (select public.is_admin('admin'))
    or ((select public.is_admin('validator')) and review_status = 'pending')
  )
  with check (
    (select public.is_admin('admin'))
    or (
      (select public.is_admin('validator'))
      and review_status in ('approved', 'rejected')
    )
  );

-- Admin console may read all merchant_brands (not only verified) for Now vs Proposed.
drop policy if exists merchant_brands_admin_select on public.merchant_brands;
create policy merchant_brands_admin_select on public.merchant_brands
  for select to authenticated
  using ((select public.is_admin('viewer')));

-- ---------------------------------------------------------------------------
-- Helpers: brand id, ensure MCC row, recompute chain status from evidence
-- ---------------------------------------------------------------------------
create or replace function public.merchant_brand_id_for_chain(p_chain text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(btrim(p_chain)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.ensure_mcc_code(
  p_mcc public.mcc_code,
  p_name text default null,
  p_source_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mcc_codes (mcc, name, source_url, status, captured_at, verified_at, reviewed_by, last_verified)
  values (
    p_mcc,
    coalesce(nullif(btrim(p_name), ''), 'MCC ' || p_mcc),
    p_source_url,
    'verified'::public.catalog_status,
    now(),
    now(),
    coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user),
    current_date
  )
  on conflict (mcc) do nothing;
end
$$;

-- Status rules (Done when #96), partitioned so Amex and Visa/MC (and channels)
-- don't falsely conflict — amex_mcc exists precisely because Amex can differ:
--   conflict  = same network-family + channel has disagreeing non-null MCCs
--   verified  = ≥2 distinct source_types agree on one MCC within a partition
--   else      = pending
-- Network family: amex alone; visa | mastercard | visa_mc | all together.
create or replace function public.mcc_evidence_network_family(p_network public.mcc_network)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_network = 'amex' then 'amex' else 'visa_mc' end;
$$;

create or replace function public.recompute_merchant_brand_mcc_status(p_brand_id text)
returns public.catalog_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflict boolean := false;
  v_agree_sources int := 0;
  v_status public.catalog_status := 'pending';
begin
  select exists (
    select 1
    from public.merchant_code_evidence e1
    join public.merchant_code_evidence e2
      on e1.merchant_brand_id = e2.merchant_brand_id
     and e1.id < e2.id
     and e1.mcc is not null
     and e2.mcc is not null
     and e1.mcc is distinct from e2.mcc
     and e1.channel = e2.channel
     and public.mcc_evidence_network_family(e1.network)
       = public.mcc_evidence_network_family(e2.network)
    where e1.merchant_brand_id = p_brand_id
  ) into v_conflict;

  if v_conflict then
    v_status := 'conflict';
  else
    select count(distinct e.source_type)::int
    into v_agree_sources
    from public.merchant_code_evidence e
    where e.merchant_brand_id = p_brand_id
      and e.mcc is not null
    group by
      public.mcc_evidence_network_family(e.network),
      e.channel,
      e.mcc
    order by count(distinct e.source_type) desc
    limit 1;

    if coalesce(v_agree_sources, 0) >= 2 then
      v_status := 'verified';
    else
      v_status := 'pending';
    end if;
  end if;

  update public.merchant_brands
  set
    status = v_status,
    verified_at = case when v_status = 'verified' then coalesce(verified_at, now()) else verified_at end,
    last_verified = case when v_status = 'verified' then current_date else last_verified end,
    reviewed_by = coalesce(nullif(auth.jwt() ->> 'email', ''), reviewed_by)
  where id = p_brand_id;

  return v_status;
end
$$;

revoke all on function public.mcc_evidence_network_family(public.mcc_network)
  from public, anon, authenticated;

create or replace function public.ensure_merchant_brand_for_chain(
  p_chain text,
  p_wikidata_id text default null,
  p_source_url text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_existing text;
begin
  select id into v_existing
  from public.merchant_brands
  where lower(name) = lower(btrim(p_chain))
  order by case when status = 'verified' then 0 else 1 end, id
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  v_id := public.merchant_brand_id_for_chain(p_chain);
  if v_id is null or v_id = '' then
    raise exception 'invalid chain name' using errcode = '22023';
  end if;

  -- Avoid colliding with an unrelated brand that already owns this slug.
  if exists (select 1 from public.merchant_brands where id = v_id) then
    v_id := v_id || '-' || substr(md5(lower(btrim(p_chain))), 1, 6);
  end if;

  insert into public.merchant_brands (
    id, name, category, operator, notes, source_url,
    last_verified, captured_at, status
  ) values (
    v_id,
    btrim(p_chain),
    'other',
    null,
    case when p_wikidata_id is not null then 'wikidata:' || p_wikidata_id else null end,
    coalesce(p_source_url, 'https://northtap.app/admin/review'),
    current_date,
    now(),
    'pending'::public.catalog_status
  );

  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Approve / reject RPCs (validators; catalog writes via security definer)
-- ---------------------------------------------------------------------------
create or replace function public.reject_merchant_code_finding(
  p_finding_id uuid,
  p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finding public.merchant_code_findings%rowtype;
begin
  if not public.is_admin('validator') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_review_note is null or length(btrim(p_review_note)) = 0 then
    raise exception 'review note required' using errcode = '22023';
  end if;

  select * into v_finding
  from public.merchant_code_findings
  where id = p_finding_id and review_status = 'pending'
  for update;

  if not found then
    return null;
  end if;

  update public.merchant_code_findings
  set
    review_status = 'rejected',
    review_note = btrim(p_review_note)
  where id = p_finding_id;

  return jsonb_build_object('id', p_finding_id, 'review_status', 'rejected');
end
$$;

create or replace function public.approve_merchant_code_finding(
  p_finding_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finding public.merchant_code_findings%rowtype;
  v_proposed jsonb;
  v_kind public.merchant_code_finding_kind;
  v_brand_id text;
  v_chain text;
  v_mcc public.mcc_code;
  v_amex public.mcc_code;
  v_network public.mcc_network;
  v_channel public.mcc_channel;
  v_certainty public.mcc_certainty;
  v_source_type public.merchant_code_source_type;
  v_url text;
  v_quote text;
  v_observed date;
  v_status public.catalog_status;
  v_before jsonb;
  v_actor text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user);
  v_category text;
  v_osm text;
  v_name text;
  v_note text;
  v_source_url text;
begin
  if not public.is_admin('validator') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_finding
  from public.merchant_code_findings
  where id = p_finding_id and review_status = 'pending'
  for update;

  if not found then
    return null;
  end if;

  v_proposed := v_finding.proposed;
  v_kind := v_finding.kind;

  if v_kind = 'store_code' then
    v_chain := nullif(btrim(v_proposed ->> 'chain'), '');
    v_mcc := nullif(btrim(v_proposed ->> 'mcc'), '')::public.mcc_code;
    v_network := coalesce((v_proposed ->> 'network')::public.mcc_network, 'all');
    v_channel := coalesce((v_proposed ->> 'channel')::public.mcc_channel, 'in_store');
    v_certainty := coalesce((v_proposed ->> 'certainty')::public.mcc_certainty, 'unknown');
    v_source_type := (v_proposed ->> 'source_type')::public.merchant_code_source_type;
    v_url := nullif(btrim(v_proposed ->> 'url'), '');
    v_quote := nullif(btrim(v_proposed ->> 'quote'), '');
    v_observed := (v_proposed ->> 'observed_date')::date;

    if v_chain is null or v_mcc is null or v_source_type is null
       or v_url is null or v_quote is null or v_observed is null then
      raise exception 'store_code finding is missing required fields' using errcode = '22023';
    end if;

    perform public.ensure_mcc_code(v_mcc, null, v_url);
    v_brand_id := public.ensure_merchant_brand_for_chain(
      v_chain,
      nullif(btrim(v_proposed ->> 'wikidata_id'), ''),
      v_url
    );

    select jsonb_build_object(
      'mcc', mcc, 'amex_mcc', amex_mcc, 'certainty', certainty, 'status', status
    )
    into v_before
    from public.merchant_brands where id = v_brand_id;

    insert into public.merchant_code_evidence (
      merchant_brand_id, chain, mcc, network, channel, source_type,
      url, quote, observed_date
    ) values (
      v_brand_id, v_chain, v_mcc, v_network, v_channel, v_source_type,
      v_url, v_quote, v_observed
    );

    if v_network = 'amex' then
      v_amex := v_mcc;
      update public.merchant_brands
      set amex_mcc = v_amex, certainty = v_certainty
      where id = v_brand_id;
    else
      update public.merchant_brands
      set mcc = v_mcc, certainty = v_certainty
      where id = v_brand_id;
    end if;

    v_status := public.recompute_merchant_brand_mcc_status(v_brand_id);

    insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
    values (
      v_actor,
      'merchant_brand.approve_store_code',
      'merchant_brands',
      v_brand_id,
      v_before,
      jsonb_build_object(
        'finding_id', p_finding_id,
        'mcc', case when v_network = 'amex' then null else v_mcc end,
        'amex_mcc', case when v_network = 'amex' then v_mcc else null end,
        'certainty', v_certainty,
        'status', v_status,
        'chain', v_chain
      )
    );

  elsif v_kind = 'test_purchase' then
    v_chain := nullif(btrim(v_proposed ->> 'chain'), '');
    if v_chain is null then
      v_chain := nullif(btrim(v_proposed ->> 'location'), '');
    end if;
    v_mcc := nullif(btrim(v_proposed ->> 'mcc_shown'), '')::public.mcc_code;
    v_network := coalesce((v_proposed ->> 'network')::public.mcc_network, 'all');
    v_observed := (v_proposed ->> 'date')::date;
    v_quote := nullif(btrim(v_proposed ->> 'statement_text'), '');

    if v_chain is null or v_observed is null or v_quote is null then
      raise exception 'test_purchase finding is missing required fields' using errcode = '22023';
    end if;

    if v_mcc is not null then
      perform public.ensure_mcc_code(v_mcc);
    end if;

    v_brand_id := public.ensure_merchant_brand_for_chain(v_chain, null, null);

    select jsonb_build_object(
      'mcc', mcc, 'amex_mcc', amex_mcc, 'certainty', certainty, 'status', status
    )
    into v_before
    from public.merchant_brands where id = v_brand_id;

    insert into public.merchant_code_evidence (
      merchant_brand_id, chain, mcc, network, channel, source_type,
      statement_text, location, format, store_number, city,
      card_id, screenshot_path, mcc_shown, category_shown, observed_date
    ) values (
      v_brand_id,
      v_chain,
      v_mcc,
      v_network,
      'in_store',
      'test_purchase',
      v_quote,
      nullif(btrim(v_proposed ->> 'location'), ''),
      nullif(btrim(v_proposed ->> 'format'), ''),
      nullif(btrim(v_proposed ->> 'store_number'), ''),
      nullif(btrim(v_proposed ->> 'city'), ''),
      nullif(btrim(v_proposed ->> 'card_id'), ''),
      nullif(btrim(v_proposed ->> 'screenshot_file'), ''),
      v_mcc,
      nullif(btrim(v_proposed ->> 'category_shown'), ''),
      v_observed
    );

    if v_mcc is not null then
      if v_network = 'amex' then
        update public.merchant_brands
        set amex_mcc = v_mcc, certainty = 'confirmed'
        where id = v_brand_id;
      else
        update public.merchant_brands
        set mcc = v_mcc, certainty = 'confirmed'
        where id = v_brand_id;
      end if;
    end if;

    v_status := public.recompute_merchant_brand_mcc_status(v_brand_id);

    insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
    values (
      v_actor,
      'merchant_brand.approve_test_purchase',
      'merchant_brands',
      v_brand_id,
      v_before,
      jsonb_build_object(
        'finding_id', p_finding_id,
        'mcc', v_mcc,
        'status', v_status,
        'chain', v_chain
      )
    );

  elsif v_kind = 'mcc_code' then
    v_mcc := nullif(btrim(v_proposed ->> 'mcc'), '')::public.mcc_code;
    v_name := nullif(btrim(v_proposed ->> 'name'), '');
    v_source_url := nullif(btrim(v_proposed ->> 'source_url'), '');
    if v_mcc is null or v_name is null then
      raise exception 'mcc_code finding is missing required fields' using errcode = '22023';
    end if;

    insert into public.mcc_codes (
      mcc, name, source_url, status, captured_at, verified_at, reviewed_by, last_verified
    ) values (
      v_mcc, v_name, v_source_url, 'verified', now(), now(), v_actor, current_date
    )
    on conflict (mcc) do update set
      name = excluded.name,
      source_url = coalesce(excluded.source_url, public.mcc_codes.source_url),
      status = 'verified',
      verified_at = now(),
      reviewed_by = v_actor,
      last_verified = current_date;

  elsif v_kind = 'category_mcc' then
    v_category := nullif(btrim(v_proposed ->> 'category'), '');
    v_mcc := nullif(btrim(v_proposed ->> 'mcc'), '')::public.mcc_code;
    v_source_url := nullif(btrim(v_proposed ->> 'source_url'), '');
    if v_category is null or v_mcc is null then
      raise exception 'category_mcc finding is missing required fields' using errcode = '22023';
    end if;
    perform public.ensure_mcc_code(v_mcc, null, v_source_url);
    insert into public.category_mccs (
      category, mcc, source_url, status, captured_at, verified_at, reviewed_by
    ) values (
      v_category, v_mcc, v_source_url, 'verified', now(), now(), v_actor
    )
    on conflict (category, mcc) do update set
      source_url = coalesce(excluded.source_url, public.category_mccs.source_url),
      status = 'verified',
      verified_at = now(),
      reviewed_by = v_actor;

  elsif v_kind = 'store_type_mcc' then
    v_osm := nullif(btrim(v_proposed ->> 'osm_tag'), '');
    v_mcc := nullif(btrim(v_proposed ->> 'mcc'), '')::public.mcc_code;
    v_note := nullif(btrim(v_proposed ->> 'note'), '');
    if v_osm is null or v_mcc is null then
      raise exception 'store_type_mcc finding is missing required fields' using errcode = '22023';
    end if;
    perform public.ensure_mcc_code(v_mcc);
    insert into public.store_type_mccs (
      osm_tag, mcc, note, status, captured_at, verified_at, reviewed_by
    ) values (
      v_osm, v_mcc, v_note, 'verified', now(), now(), v_actor
    )
    on conflict (osm_tag) do update set
      mcc = excluded.mcc,
      note = coalesce(excluded.note, public.store_type_mccs.note),
      status = 'verified',
      verified_at = now(),
      reviewed_by = v_actor;
  else
    raise exception 'unsupported finding kind' using errcode = '22023';
  end if;

  update public.merchant_code_findings
  set
    review_status = 'approved',
    review_note = nullif(btrim(coalesce(p_review_note, '')), '')
  where id = p_finding_id;

  return jsonb_build_object(
    'id', p_finding_id,
    'review_status', 'approved',
    'kind', v_kind,
    'merchant_brand_id', v_brand_id,
    'status', v_status
  );
end
$$;

revoke all on function public.merchant_brand_id_for_chain(text) from public, anon, authenticated;
revoke all on function public.ensure_mcc_code(public.mcc_code, text, text) from public, anon, authenticated;
revoke all on function public.recompute_merchant_brand_mcc_status(text) from public, anon, authenticated;
revoke all on function public.ensure_merchant_brand_for_chain(text, text, text) from public, anon, authenticated;
revoke all on function public.reject_merchant_code_finding(uuid, text) from public, anon, authenticated;
revoke all on function public.approve_merchant_code_finding(uuid, text) from public, anon, authenticated;

grant execute on function public.reject_merchant_code_finding(uuid, text) to authenticated;
grant execute on function public.approve_merchant_code_finding(uuid, text) to authenticated;
