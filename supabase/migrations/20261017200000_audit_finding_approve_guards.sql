-- Audit #142 / #143: validators may only reject card_findings via direct UPDATE;
-- approved is reachable only through approve_finding_to_catalog. That RPC must
-- refuse a p_card_op that diverges from saved review_fields, and validate
-- reward_categories shape/bounds before writing cards.

-- ---------------------------------------------------------------------------
-- #142: direct UPDATE may only move pending → rejected
-- ---------------------------------------------------------------------------
drop policy if exists card_findings_update on public.card_findings;
create policy card_findings_update on public.card_findings
  for update to authenticated
  using ((select public.is_admin('validator')) and review_status = 'pending')
  with check ((select public.is_admin('validator')) and review_status = 'rejected');

-- ---------------------------------------------------------------------------
-- Helpers for #143
-- ---------------------------------------------------------------------------
create or replace function public.review_saved_value(p_review_fields jsonb, p_key text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(f->>'value'), '')
  from jsonb_array_elements(p_review_fields -> 'fields') as f
  where coalesce((f->>'save')::boolean, false)
    and f->>'key' = p_key
  limit 1;
$$;

-- Raw saved value (distinguishes "not saved" from "saved empty").
create or replace function public.review_saved_raw(p_review_fields jsonb, p_key text)
returns text
language sql
stable
set search_path = ''
as $$
  select f->>'value'
  from jsonb_array_elements(p_review_fields -> 'fields') as f
  where coalesce((f->>'save')::boolean, false)
    and f->>'key' = p_key
  limit 1;
$$;

-- Mirrors isEmpty() in catalog-write-parse.ts: blank or "none" clears a field.
create or replace function public.review_value_is_clear(p_raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_raw), '') = '' or lower(btrim(p_raw)) = 'none';
$$;

create or replace function public.review_field_saved(p_review_fields jsonb, p_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(p_review_fields -> 'fields') as f
    where coalesce((f->>'save')::boolean, false)
      and f->>'key' = p_key
  );
$$;

create or replace function public.review_has_saved_prefix(p_review_fields jsonb, p_prefix text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(p_review_fields -> 'fields') as f
    where coalesce((f->>'save')::boolean, false)
      and f->>'key' like p_prefix || '%'
  );
$$;

create or replace function public.map_review_network(p_raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(p_raw))
    when 'visa' then 'Visa'
    when 'mastercard' then 'Mastercard'
    when 'american express' then 'Amex'
    when 'amex' then 'Amex'
    else null
  end;
$$;

-- Known spend categories (apps/api CATEGORIES) plus finite rate / size caps.
create or replace function public.validate_reward_categories(p_categories jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_elem jsonb;
  v_i int := 0;
  v_category text;
  v_rate numeric;
  v_known text[] := array[
    'groceries', 'dining', 'gas', 'transit', 'drugstore',
    'recurring_bills', 'travel', 'foreign_currency', 'entertainment', 'other'
  ];
  v_num_keys text[] := array[
    'earnRate', 'capMonthly', 'capAnnual', 'rateAfterCap', 'tierThreshold'
  ];
  v_key text;
  v_num numeric;
begin
  if p_categories is null or jsonb_typeof(p_categories) <> 'array' then
    raise exception 'reward_categories must be a json array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_categories) > 64 then
    raise exception 'reward_categories exceeds size cap' using errcode = '22023';
  end if;

  for v_elem in select value from jsonb_array_elements(p_categories)
  loop
    v_i := v_i + 1;
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'reward_categories[%] must be an object', v_i - 1
        using errcode = '22023';
    end if;

    v_category := nullif(btrim(v_elem ->> 'category'), '');
    if v_category is null or not (v_category = any (v_known)) then
      raise exception 'reward_categories[%] has unknown category', v_i - 1
        using errcode = '22023';
    end if;

    if v_elem -> 'earnRate' is null or jsonb_typeof(v_elem -> 'earnRate') <> 'number' then
      raise exception 'reward_categories[%] earnRate must be a finite number', v_i - 1
        using errcode = '22023';
    end if;
    v_rate := (v_elem ->> 'earnRate')::numeric;
    if v_rate is null or v_rate < 0 or v_rate > 100 then
      raise exception 'reward_categories[%] earnRate out of bounds', v_i - 1
        using errcode = '22023';
    end if;

    foreach v_key in array v_num_keys
    loop
      if v_key = 'earnRate' then
        continue;
      end if;
      if v_elem ? v_key and v_elem -> v_key is not null
         and v_elem -> v_key <> 'null'::jsonb then
        if jsonb_typeof(v_elem -> v_key) <> 'number' then
          raise exception 'reward_categories[%].% must be a number', v_i - 1, v_key
            using errcode = '22023';
        end if;
        v_num := (v_elem ->> v_key)::numeric;
        if v_num is null or v_num < 0 or v_num > 1000000 then
          raise exception 'reward_categories[%].% out of bounds', v_i - 1, v_key
            using errcode = '22023';
        end if;
      end if;
    end loop;

    if (v_elem ? 'mccSource')
       and nullif(btrim(v_elem ->> 'mccSource'), '') is not null
       and nullif(btrim(v_elem ->> 'mccSource'), '') not in ('terms', 'network_default') then
      raise exception 'reward_categories[%] has invalid mccSource', v_i - 1
        using errcode = '22023';
    end if;

    if (v_elem ? 'quote') and length(coalesce(v_elem ->> 'quote', '')) > 2000 then
      raise exception 'reward_categories[%] quote exceeds size cap', v_i - 1
        using errcode = '22023';
    end if;
    if (v_elem ? 'sourceUrl') and length(coalesce(v_elem ->> 'sourceUrl', '')) > 2000 then
      raise exception 'reward_categories[%] sourceUrl exceeds size cap', v_i - 1
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Compare reward_categories content to saved earn_rate.<cat> values (and keep
-- uncovered entries identical to the existing catalog row on update).
create or replace function public.assert_reward_categories_match_review(
  p_categories jsonb,
  p_review_fields jsonb,
  p_existing jsonb,
  p_extracted jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_f jsonb;
  v_key text;
  v_cat text;
  v_expected numeric;
  v_max numeric;
  v_covered text[] := array[]::text[];
  v_has_promo boolean := false;
  v_idx int;
  v_elem jsonb;
  v_ext_cat text;
begin
  if p_categories is null or jsonb_typeof(p_categories) <> 'array' then
    return;
  end if;

  for v_f in
    select f
    from jsonb_array_elements(p_review_fields -> 'fields') as f
    where coalesce((f->>'save')::boolean, false)
  loop
    v_key := v_f->>'key';
    if v_key like 'earn_rate.%' and v_key not like 'earn_rates[%' then
      v_cat := nullif(btrim(substr(v_key, length('earn_rate.') + 1)), '');
      if v_cat is null then
        raise exception 'card_op reward_categories does not match review_fields'
          using errcode = '22023';
      end if;
      begin
        v_expected := (v_f->>'value')::numeric;
      exception when others then
        raise exception 'card_op reward_categories does not match review_fields'
          using errcode = '22023';
      end;
      select max((e->>'earnRate')::numeric)
        into v_max
      from jsonb_array_elements(p_categories) as e
      where e->>'category' = v_cat;
      if v_max is distinct from v_expected then
        raise exception 'card_op reward_categories does not match review_fields'
          using errcode = '22023';
      end if;
      if not (v_cat = any (v_covered)) then
        v_covered := v_covered || v_cat;
      end if;
    elsif v_key like 'earn_rates[%' then
      v_idx := substring(v_key from 'earn_rates\[(\d+)\]')::int;
      v_ext_cat := nullif(
        btrim(p_extracted -> 'earn_rates' -> v_idx ->> 'category'),
        ''
      );
      if v_ext_cat is not null and not (v_ext_cat = any (v_covered)) then
        v_covered := v_covered || v_ext_cat;
      end if;
    elsif v_key like 'promotion.%' then
      v_has_promo := true;
    end if;
  end loop;

  -- Update only: uncovered entries must stay identical to the live catalog row.
  if p_existing is null or jsonb_typeof(p_existing) <> 'array' then
    return;
  end if;

  for v_elem in select value from jsonb_array_elements(p_existing)
  loop
    v_cat := v_elem->>'category';
    if v_cat is null or v_cat = any (v_covered) then
      continue;
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_categories) as e where e = v_elem
    ) then
      raise exception 'card_op reward_categories does not match review_fields'
        using errcode = '22023';
    end if;
  end loop;

  for v_elem in select value from jsonb_array_elements(p_categories)
  loop
    v_cat := v_elem->>'category';
    if v_cat is null or v_cat = any (v_covered) then
      continue;
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_existing) as e where e = v_elem
    ) then
      continue;
    end if;
    -- Promotions may append dated rows that are not yet on the catalog card.
    if v_has_promo then
      continue;
    end if;
    raise exception 'card_op reward_categories does not match review_fields'
      using errcode = '22023';
  end loop;
end;
$$;

-- Compare welcome_offer to saved welcome_bonus.* (mirrors catalog-write-offers.ts).
create or replace function public.assert_welcome_offer_match_review(
  p_offer jsonb,
  p_review_fields jsonb,
  p_existing jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
  v_expected numeric;
  v_bool boolean;
  v_offer jsonb := case
    when p_offer is null or p_offer = 'null'::jsonb then '{}'::jsonb
    else p_offer
  end;
  v_existing jsonb := case
    when p_existing is null or p_existing = 'null'::jsonb then '{}'::jsonb
    else p_existing
  end;
  v_cleared boolean := false;
begin
  if p_offer is not null
     and p_offer <> 'null'::jsonb
     and jsonb_typeof(p_offer) <> 'object' then
    raise exception 'welcome_offer must be an object or null' using errcode = '22023';
  end if;

  -- welcome_bonus.points → points
  if public.review_field_saved(p_review_fields, 'welcome_bonus.points') then
    v_raw := coalesce(public.review_saved_raw(p_review_fields, 'welcome_bonus.points'), '');
    if nullif(btrim(v_raw), '') is null then
      v_cleared := true;
      if v_offer ? 'points'
         and v_offer -> 'points' is not null
         and v_offer -> 'points' <> 'null'::jsonb then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    else
      begin
        v_expected := btrim(v_raw)::numeric;
      exception when others then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end;
      if (v_offer ->> 'points')::numeric is distinct from v_expected then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    end if;
  elsif p_existing is not null then
    if (v_offer -> 'points') is distinct from (v_existing -> 'points') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;

  -- welcome_bonus.rate → rate
  if public.review_field_saved(p_review_fields, 'welcome_bonus.rate') then
    v_raw := coalesce(public.review_saved_raw(p_review_fields, 'welcome_bonus.rate'), '');
    if nullif(btrim(v_raw), '') is null then
      if v_offer ? 'rate'
         and v_offer -> 'rate' is not null
         and v_offer -> 'rate' <> 'null'::jsonb then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    else
      begin
        v_expected := btrim(v_raw)::numeric;
      exception when others then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end;
      if (v_offer ->> 'rate')::numeric is distinct from v_expected then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    end if;
  elsif p_existing is not null then
    if (v_offer -> 'rate') is distinct from (v_existing -> 'rate') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;

  -- welcome_bonus.valid_from → validFrom
  if public.review_field_saved(p_review_fields, 'welcome_bonus.valid_from') then
    v_raw := nullif(btrim(coalesce(public.review_saved_raw(p_review_fields, 'welcome_bonus.valid_from'), '')), '');
    if v_raw is null then
      if nullif(btrim(v_offer ->> 'validFrom'), '') is not null then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    elsif nullif(btrim(v_offer ->> 'validFrom'), '') is distinct from v_raw then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  elsif p_existing is not null then
    if nullif(btrim(v_offer ->> 'validFrom'), '')
         is distinct from nullif(btrim(v_existing ->> 'validFrom'), '') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;

  -- welcome_bonus.valid_to → validTo
  if public.review_field_saved(p_review_fields, 'welcome_bonus.valid_to') then
    v_raw := nullif(btrim(coalesce(public.review_saved_raw(p_review_fields, 'welcome_bonus.valid_to'), '')), '');
    if v_raw is null then
      if nullif(btrim(v_offer ->> 'validTo'), '') is not null then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    elsif nullif(btrim(v_offer ->> 'validTo'), '') is distinct from v_raw then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  elsif p_existing is not null then
    if nullif(btrim(v_offer ->> 'validTo'), '')
         is distinct from nullif(btrim(v_existing ->> 'validTo'), '') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;

  -- welcome_bonus.new_cardholders_only → newCardholdersOnly
  if public.review_field_saved(p_review_fields, 'welcome_bonus.new_cardholders_only') then
    v_raw := nullif(
      btrim(coalesce(public.review_saved_raw(p_review_fields, 'welcome_bonus.new_cardholders_only'), '')),
      ''
    );
    if v_raw is null then
      if v_offer ? 'newCardholdersOnly'
         and v_offer -> 'newCardholdersOnly' is not null
         and v_offer -> 'newCardholdersOnly' <> 'null'::jsonb then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    else
      v_bool := case lower(v_raw)
        when 'yes' then true
        when 'true' then true
        when 'no' then false
        when 'false' then false
        else null
      end;
      if v_bool is null
         or (v_offer ->> 'newCardholdersOnly')::boolean is distinct from v_bool then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    end if;
  elsif p_existing is not null then
    if (v_offer -> 'newCardholdersOnly') is distinct from (v_existing -> 'newCardholdersOnly') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;

  -- Uncovered catalog-only fields must stay identical on update.
  -- summary may be rewritten when points are saved (catalog-write-offers.ts).
  if p_existing is not null and not v_cleared then
    if not public.review_field_saved(p_review_fields, 'welcome_bonus.points')
       and nullif(btrim(v_offer ->> 'summary'), '')
            is distinct from nullif(btrim(v_existing ->> 'summary'), '') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
    if (v_offer -> 'estimatedValueCad') is distinct from (v_existing -> 'estimatedValueCad') then
      raise exception 'card_op welcome_offer does not match review_fields'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

-- Ensure p_card_op only writes values justified by saved review_fields.
drop function if exists public.assert_card_op_matches_review(jsonb, jsonb, text, text, text);
drop function if exists public.assert_card_op_matches_review(jsonb, jsonb, text, text, text, jsonb, jsonb);
create or replace function public.assert_card_op_matches_review(
  p_card_op jsonb,
  p_review_fields jsonb,
  p_diff_kind text,
  p_finding_card_name text,
  p_issuer_name text,
  p_existing_reward_categories jsonb default null,
  p_extracted jsonb default null,
  p_existing_welcome_offer jsonb default null
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_op text;
  v_payload jsonb;
  v_key text;
  v_allowed text[] := array['last_verified', 'verified_at', 'status'];
  v_saved text;
  v_mapped text;
  v_has_earn boolean;
  v_has_welcome boolean;
  v_name text;
  v_fee numeric;
  v_network text;
begin
  v_op := p_card_op ->> 'op';
  v_has_earn := public.review_has_saved_prefix(p_review_fields, 'earn_rate.')
    or public.review_has_saved_prefix(p_review_fields, 'earn_rates[')
    or public.review_has_saved_prefix(p_review_fields, 'promotion.');
  v_has_welcome := public.review_has_saved_prefix(p_review_fields, 'welcome_bonus.');

  if v_op = 'update' then
    v_payload := p_card_op -> 'set';
    if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
      raise exception 'card_op.set is required for update' using errcode = '22023';
    end if;

    v_saved := public.review_saved_value(p_review_fields, 'name');
    if v_saved is not null then
      v_allowed := v_allowed || array['name'];
      if not (v_payload ? 'name')
         or nullif(btrim(v_payload ->> 'name'), '') is distinct from v_saved then
        raise exception 'card_op name does not match review_fields'
          using errcode = '22023';
      end if;
    end if;

    v_saved := public.review_saved_value(p_review_fields, 'annual_fee');
    if v_saved is not null then
      v_allowed := v_allowed || array['annual_fee'];
      begin
        v_fee := v_saved::numeric;
      exception when others then
        raise exception 'card_op annual_fee does not match review_fields'
          using errcode = '22023';
      end;
      if not (v_payload ? 'annual_fee')
         or (v_payload ->> 'annual_fee')::numeric is distinct from v_fee then
        raise exception 'card_op annual_fee does not match review_fields'
          using errcode = '22023';
      end if;
    end if;

    if public.review_field_saved(p_review_fields, 'network') then
      v_allowed := v_allowed || array['network'];
      v_saved := public.review_saved_raw(p_review_fields, 'network');
      if public.review_value_is_clear(v_saved) then
        v_mapped := null;
      else
        v_mapped := public.map_review_network(v_saved);
        if v_mapped is null then
          raise exception 'card_op network does not match review_fields'
            using errcode = '22023';
        end if;
      end if;
      if not (v_payload ? 'network')
         or nullif(btrim(v_payload ->> 'network'), '') is distinct from v_mapped then
        raise exception 'card_op network does not match review_fields'
          using errcode = '22023';
      end if;
    end if;

    if v_has_earn then
      v_allowed := v_allowed || array['reward_categories'];
      if not (v_payload ? 'reward_categories') then
        raise exception 'card_op reward_categories required by review_fields'
          using errcode = '22023';
      end if;
      perform public.validate_reward_categories(v_payload -> 'reward_categories');
      perform public.assert_reward_categories_match_review(
        v_payload -> 'reward_categories',
        p_review_fields,
        p_existing_reward_categories,
        p_extracted
      );
    end if;

    if v_has_welcome then
      v_allowed := v_allowed || array['welcome_offer'];
      if not (v_payload ? 'welcome_offer') then
        raise exception 'card_op welcome_offer required by review_fields'
          using errcode = '22023';
      end if;
      perform public.assert_welcome_offer_match_review(
        v_payload -> 'welcome_offer',
        p_review_fields,
        p_existing_welcome_offer
      );
    end if;

    for v_key in select jsonb_object_keys(v_payload)
    loop
      if not (v_key = any (v_allowed)) then
        raise exception 'card_op.set contains unjustified key %', v_key
          using errcode = '22023';
      end if;
    end loop;

  elsif v_op = 'insert' then
    if p_diff_kind is distinct from 'new' then
      raise exception 'catalog insert is only allowed for new findings'
        using errcode = '22023';
    end if;
    v_payload := p_card_op -> 'row';
    if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
      raise exception 'card_op.row is required for insert' using errcode = '22023';
    end if;

    v_name := coalesce(
      public.review_saved_value(p_review_fields, 'name'),
      nullif(btrim(p_finding_card_name), '')
    );
    if v_name is null
       or nullif(btrim(v_payload ->> 'name'), '') is distinct from v_name then
      raise exception 'card_op name does not match review_fields'
        using errcode = '22023';
    end if;

    if nullif(btrim(v_payload ->> 'issuer'), '') is distinct from nullif(btrim(p_issuer_name), '') then
      raise exception 'card_op issuer does not match finding source'
        using errcode = '22023';
    end if;

    v_saved := public.review_saved_value(p_review_fields, 'annual_fee');
    if v_saved is not null then
      begin
        v_fee := v_saved::numeric;
      exception when others then
        raise exception 'card_op annual_fee does not match review_fields'
          using errcode = '22023';
      end;
      if (v_payload ->> 'annual_fee')::numeric is distinct from v_fee then
        raise exception 'card_op annual_fee does not match review_fields'
          using errcode = '22023';
      end if;
    end if;

    if public.review_field_saved(p_review_fields, 'network') then
      v_saved := public.review_saved_raw(p_review_fields, 'network');
      if public.review_value_is_clear(v_saved) then
        v_mapped := null;
      else
        v_mapped := public.map_review_network(v_saved);
        if v_mapped is null then
          raise exception 'card_op network does not match review_fields'
            using errcode = '22023';
        end if;
      end if;
      v_network := nullif(btrim(v_payload ->> 'network'), '');
      if v_network is distinct from v_mapped then
        raise exception 'card_op network does not match review_fields'
          using errcode = '22023';
      end if;
    end if;

    perform public.validate_reward_categories(v_payload -> 'reward_categories');
    perform public.assert_reward_categories_match_review(
      v_payload -> 'reward_categories',
      p_review_fields,
      null,
      p_extracted
    );

    if v_has_welcome then
      perform public.assert_welcome_offer_match_review(
        v_payload -> 'welcome_offer',
        p_review_fields,
        null
      );
    elsif v_payload ? 'welcome_offer'
       and v_payload -> 'welcome_offer' is not null
       and v_payload -> 'welcome_offer' <> 'null'::jsonb then
      raise exception 'card_op welcome_offer not justified by review_fields'
        using errcode = '22023';
    end if;
  end if;
end;
$$;

revoke all on function public.review_saved_value(jsonb, text) from public, anon, authenticated;
revoke all on function public.review_saved_raw(jsonb, text) from public, anon, authenticated;
revoke all on function public.review_field_saved(jsonb, text) from public, anon, authenticated;
revoke all on function public.review_value_is_clear(text) from public, anon, authenticated;
revoke all on function public.review_has_saved_prefix(jsonb, text) from public, anon, authenticated;
revoke all on function public.map_review_network(text) from public, anon, authenticated;
revoke all on function public.validate_reward_categories(jsonb) from public, anon, authenticated;
revoke all on function public.assert_reward_categories_match_review(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.assert_welcome_offer_match_review(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.assert_card_op_matches_review(jsonb, jsonb, text, text, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replace approve RPC with review_fields / schema guards
-- ---------------------------------------------------------------------------
create or replace function public.approve_finding_to_catalog(
  p_finding_id uuid,
  p_review_fields jsonb,
  p_card_op jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finding public.card_findings%rowtype;
  v_op text;
  v_card_id text;
  v_row jsonb;
  v_set jsonb;
  v_name text;
  v_issuer text;
  v_annual_fee numeric;
  v_point_currency text;
  v_reward_categories jsonb;
  v_welcome_offer jsonb;
  v_network text;
  v_last_verified date;
  v_verified_at timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_issuer_name text;
  v_existing_cats jsonb;
  v_existing_welcome jsonb;
  v_actor text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user);
begin
  if not public.is_admin('validator') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_review_fields is null
     or jsonb_typeof(p_review_fields) <> 'object'
     or jsonb_typeof(p_review_fields -> 'fields') is distinct from 'array' then
    raise exception 'review_fields must be an object with a fields array'
      using errcode = '22023';
  end if;

  select * into v_finding
  from public.card_findings
  where id = p_finding_id and review_status = 'pending'
  for update;

  if not found then
    return null;
  end if;

  select s.issuer_name into v_issuer_name
  from public.crawl_sources s
  where s.id = v_finding.source_id;

  v_card_id := v_finding.linked_card_id;

  if p_card_op is not null then
    if jsonb_typeof(p_card_op) <> 'object' then
      raise exception 'card_op must be a json object' using errcode = '22023';
    end if;
    v_op := p_card_op ->> 'op';

    v_existing_cats := null;
    v_existing_welcome := null;
    if v_op = 'update' and v_finding.linked_card_id is not null then
      select c.reward_categories, c.welcome_offer
        into v_existing_cats, v_existing_welcome
      from public.cards c
      where c.id = v_finding.linked_card_id;
    end if;

    perform public.assert_card_op_matches_review(
      p_card_op,
      p_review_fields,
      v_finding.diff_kind,
      v_finding.card_name,
      v_issuer_name,
      v_existing_cats,
      v_finding.extracted,
      v_existing_welcome
    );

    if v_op = 'insert' then
      if v_finding.diff_kind is distinct from 'new' then
        raise exception 'catalog insert is only allowed for new findings'
          using errcode = '22023';
      end if;
      v_row := p_card_op -> 'row';
      if v_row is null or jsonb_typeof(v_row) <> 'object' then
        raise exception 'card_op.row is required for insert' using errcode = '22023';
      end if;

      v_card_id := nullif(btrim(v_row ->> 'id'), '');
      v_name := nullif(btrim(v_row ->> 'name'), '');
      v_issuer := nullif(btrim(v_row ->> 'issuer'), '');
      v_annual_fee := (v_row ->> 'annual_fee')::numeric;
      v_point_currency := nullif(btrim(v_row ->> 'point_currency'), '');
      v_reward_categories := v_row -> 'reward_categories';
      v_welcome_offer := v_row -> 'welcome_offer';
      v_network := nullif(btrim(v_row ->> 'network'), '');
      v_last_verified := coalesce((v_row ->> 'last_verified')::date, current_date);
      v_verified_at := coalesce((v_row ->> 'verified_at')::timestamptz, now());

      if v_card_id is null or v_name is null or v_issuer is null
         or v_point_currency is null
         or v_reward_categories is null
         or jsonb_typeof(v_reward_categories) <> 'array' then
        raise exception 'card insert is missing required fields' using errcode = '22023';
      end if;
      if v_welcome_offer is not null
         and v_welcome_offer <> 'null'::jsonb
         and jsonb_typeof(v_welcome_offer) <> 'object' then
        raise exception 'welcome_offer must be an object or null' using errcode = '22023';
      end if;
      if v_network is not null and v_network not in ('Visa', 'Mastercard', 'Amex') then
        raise exception 'invalid network' using errcode = '22023';
      end if;
      if v_annual_fee is null or v_annual_fee < 0 then
        raise exception 'invalid annual_fee' using errcode = '22023';
      end if;

      if v_welcome_offer is null or v_welcome_offer = 'null'::jsonb then
        v_welcome_offer := null;
      end if;

      insert into public.cards (
        id, name, issuer, annual_fee, point_currency, reward_categories,
        welcome_offer, network, last_verified, captured_at, verified_at, status
      ) values (
        v_card_id,
        v_name,
        v_issuer,
        v_annual_fee,
        v_point_currency,
        v_reward_categories,
        v_welcome_offer,
        v_network,
        v_last_verified,
        now(),
        v_verified_at,
        'verified'::public.catalog_status
      );

      v_after := jsonb_build_object(
        'op', 'insert',
        'finding_id', p_finding_id,
        'review_fields', p_review_fields,
        'row', jsonb_build_object(
          'id', v_card_id,
          'name', v_name,
          'issuer', v_issuer,
          'annual_fee', v_annual_fee,
          'point_currency', v_point_currency,
          'reward_categories', v_reward_categories,
          'welcome_offer', v_welcome_offer,
          'network', v_network,
          'last_verified', v_last_verified,
          'verified_at', v_verified_at,
          'status', 'verified'
        )
      );

      insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
      values (v_actor, 'card.approve_insert', 'cards', v_card_id, null, v_after);

    elsif v_op = 'update' then
      v_card_id := nullif(btrim(p_card_op ->> 'id'), '');
      if v_card_id is null or v_card_id is distinct from v_finding.linked_card_id then
        raise exception 'catalog update id must match the finding linked_card_id'
          using errcode = '22023';
      end if;
      if v_finding.diff_kind is distinct from 'changed'
         and v_finding.diff_kind is distinct from 'new' then
        raise exception 'catalog update is not allowed for this finding'
          using errcode = '22023';
      end if;

      v_set := p_card_op -> 'set';
      if v_set is null or jsonb_typeof(v_set) <> 'object' then
        raise exception 'card_op.set is required for update' using errcode = '22023';
      end if;

      if (v_set ? 'network')
         and nullif(btrim(v_set ->> 'network'), '') is not null
         and nullif(btrim(v_set ->> 'network'), '') not in ('Visa', 'Mastercard', 'Amex') then
        raise exception 'invalid network' using errcode = '22023';
      end if;
      if (v_set ? 'name') and nullif(btrim(v_set ->> 'name'), '') is null then
        raise exception 'card name cannot be empty' using errcode = '22023';
      end if;
      if (v_set ? 'annual_fee')
         and (
           (v_set ->> 'annual_fee') is null
           or (v_set ->> 'annual_fee')::numeric < 0
         ) then
        raise exception 'invalid annual_fee' using errcode = '22023';
      end if;
      if (v_set ? 'reward_categories') then
        perform public.validate_reward_categories(v_set -> 'reward_categories');
      end if;
      if (v_set ? 'welcome_offer')
         and v_set -> 'welcome_offer' is not null
         and v_set -> 'welcome_offer' <> 'null'::jsonb
         and jsonb_typeof(v_set -> 'welcome_offer') <> 'object' then
        raise exception 'welcome_offer must be an object or null' using errcode = '22023';
      end if;

      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'issuer', c.issuer,
        'annual_fee', c.annual_fee,
        'point_currency', c.point_currency,
        'reward_categories', c.reward_categories,
        'welcome_offer', c.welcome_offer,
        'network', c.network,
        'last_verified', c.last_verified,
        'verified_at', c.verified_at,
        'status', c.status
      )
      into v_before
      from public.cards c
      where c.id = v_card_id;

      if v_before is null then
        raise exception 'catalog card % not found', v_card_id using errcode = 'P0002';
      end if;

      update public.cards c
      set
        name = case when v_set ? 'name' then btrim(v_set ->> 'name') else c.name end,
        annual_fee = case
          when v_set ? 'annual_fee' then (v_set ->> 'annual_fee')::numeric
          else c.annual_fee
        end,
        network = case
          when v_set ? 'network' then nullif(btrim(v_set ->> 'network'), '')
          else c.network
        end,
        reward_categories = case
          when v_set ? 'reward_categories' then v_set -> 'reward_categories'
          else c.reward_categories
        end,
        welcome_offer = case
          when v_set ? 'welcome_offer' then
            case
              when v_set -> 'welcome_offer' is null
                or v_set -> 'welcome_offer' = 'null'::jsonb then null
              else v_set -> 'welcome_offer'
            end
          else c.welcome_offer
        end,
        last_verified = coalesce((v_set ->> 'last_verified')::date, current_date),
        verified_at = coalesce((v_set ->> 'verified_at')::timestamptz, now()),
        status = 'verified'::public.catalog_status
      where c.id = v_card_id;

      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'issuer', c.issuer,
        'annual_fee', c.annual_fee,
        'point_currency', c.point_currency,
        'reward_categories', c.reward_categories,
        'welcome_offer', c.welcome_offer,
        'network', c.network,
        'last_verified', c.last_verified,
        'verified_at', c.verified_at,
        'status', c.status
      )
      into v_after
      from public.cards c
      where c.id = v_card_id;

      insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
      values (
        v_actor,
        'card.approve_update',
        'cards',
        v_card_id,
        v_before,
        jsonb_build_object(
          'op', 'update',
          'finding_id', p_finding_id,
          'review_fields', p_review_fields,
          'set', v_set,
          'row', v_after
        )
      );

    else
      raise exception 'card_op.op must be insert or update' using errcode = '22023';
    end if;
  end if;

  update public.card_findings
  set
    review_status = 'approved',
    review_note = null,
    review_fields = p_review_fields,
    linked_card_id = coalesce(v_card_id, linked_card_id)
  where id = p_finding_id
    and review_status = 'pending';

  if not found then
    raise exception 'finding was reviewed concurrently' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'id', p_finding_id,
    'card_name', v_finding.card_name,
    'linked_card_id', coalesce(v_card_id, v_finding.linked_card_id)
  );
end;
$$;

comment on function public.approve_finding_to_catalog(uuid, jsonb, jsonb) is
  'Approve a pending finding and optionally write accepted values to cards in one transaction. Catalog op must match saved review_fields; reward_categories are schema-validated.';

revoke all on function public.approve_finding_to_catalog(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.approve_finding_to_catalog(uuid, jsonb, jsonb)
  to authenticated;
