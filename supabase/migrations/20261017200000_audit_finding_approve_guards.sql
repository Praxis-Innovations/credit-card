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

-- Mirrors parseNonNegNumber() in catalog-write-parse.ts: strips commas, null
-- when cleared, unparseable, non-finite, negative, or (p_integer) fractional.
create or replace function public.review_parse_non_neg_number(p_raw text, p_integer boolean default false)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if public.review_value_is_clear(p_raw) then
    return null;
  end if;
  begin
    v := btrim(replace(p_raw, ',', ''))::numeric;
  exception when others then
    return null;
  end;
  if v::text in ('NaN', 'Infinity', '-Infinity') or v < 0 then
    return null;
  end if;
  if p_integer and v <> trunc(v) then
    return null;
  end if;
  return v;
end;
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
      and starts_with(f->>'key', p_prefix)
  );
$$;

-- Saved decisions in review order, one row per key (later duplicates win the
-- value, the first occurrence keeps the position), like `new Map(...)` in TS.
create or replace function public.review_decisions(p_review_fields jsonb)
returns table (key text, value text, pos bigint)
language sql
stable
set search_path = ''
as $$
  select s.k, coalesce((array_agg(s.v order by s.o desc))[1], ''), min(s.o)
  from (
    select f->>'key' as k, f->>'value' as v, t.o
    from jsonb_array_elements(p_review_fields -> 'fields') with ordinality as t(f, o)
    where coalesce((f->>'save')::boolean, false)
  ) s
  group by s.k;
$$;

create or replace function public.review_iso_date(p_raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if btrim(p_raw) !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  perform btrim(p_raw)::date;
  return btrim(p_raw);
exception when others then
  return null;
end;
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

-- ---------------------------------------------------------------------------
-- reward_categories derivation: a SQL port of applyEarnRates (catalog-write-
-- rules.ts) and applyPromotions (catalog-write-offers.ts). The approve RPC
-- requires the client's reward_categories to equal this derivation exactly.
-- Inputs the admin app would refuse raise the same mismatch error.
-- ---------------------------------------------------------------------------

-- Mirrors asRewardCategories() in apply-to-catalog.ts (null = row dropped).
create or replace function public.reward_normalize_row(p_row jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rate numeric;
  v_out jsonb;
  v_key text;
  v_list jsonb;
begin
  if jsonb_typeof(p_row) is distinct from 'object'
     or jsonb_typeof(p_row -> 'category') is distinct from 'string'
     or p_row ->> 'category' = '' then
    return null;
  end if;

  case jsonb_typeof(p_row -> 'earnRate')
    when 'number' then
      v_rate := (p_row ->> 'earnRate')::numeric;
    when 'string' then
      if btrim(p_row ->> 'earnRate') = '' then
        v_rate := 0;
      else
        begin
          v_rate := btrim(p_row ->> 'earnRate')::numeric;
        exception when others then
          return null;
        end;
      end if;
    when 'boolean' then
      v_rate := case when (p_row ->> 'earnRate')::boolean then 1 else 0 end;
    when 'null' then
      v_rate := 0;
    else
      return null;
  end case;
  if v_rate::text in ('NaN', 'Infinity', '-Infinity') then
    return null;
  end if;

  v_out := jsonb_build_object('category', p_row -> 'category', 'earnRate', v_rate);

  foreach v_key in array array['capMonthly', 'capAnnual', 'rateAfterCap', 'tierThreshold']
  loop
    if jsonb_typeof(p_row -> v_key) = 'number' then
      v_out := v_out || jsonb_build_object(v_key, p_row -> v_key);
    end if;
  end loop;

  foreach v_key in array array['mccs', 'merchants', 'exclusions']
  loop
    if jsonb_typeof(p_row -> v_key) = 'array' then
      select jsonb_agg(e order by o) into v_list
      from jsonb_array_elements(p_row -> v_key) with ordinality as t(e, o)
      where jsonb_typeof(e) = 'string' and btrim(e #>> '{}') <> '';
      if v_list is not null then
        v_out := v_out || jsonb_build_object(v_key, v_list);
      end if;
    end if;
  end loop;

  if jsonb_typeof(p_row -> 'mccSource') = 'string'
     and p_row ->> 'mccSource' in ('terms', 'network_default') then
    v_out := v_out || jsonb_build_object('mccSource', p_row -> 'mccSource');
  end if;

  foreach v_key in array array['capGroup', 'validFrom', 'validTo', 'quote', 'sourceUrl']
  loop
    if jsonb_typeof(p_row -> v_key) = 'string' and btrim(p_row ->> v_key) <> '' then
      v_out := v_out || jsonb_build_object(v_key, p_row -> v_key);
    end if;
  end loop;

  return v_out;
end;
$$;

-- Mirrors INDEXED_HANDLERS in catalog-write-rules.ts. Cap amount/period are
-- staged in _capAmount/_capPeriod until reward_finalize_cap, as in TS.
create or replace function public.reward_apply_indexed_field(p_row jsonb, p_field text, p_raw text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_err constant text := 'card_op reward_categories does not match review_fields';
  v_clear boolean := public.review_value_is_clear(p_raw);
  v_parts text[];
  v_list jsonb;
  v_num numeric;
  v_key text;
  v_text text;
begin
  case p_field
    when 'mccs' then
      if v_clear then
        return p_row - 'mccs';
      end if;
      select array_agg(btrim(p) order by o) into v_parts
      from regexp_split_to_table(p_raw, '[,\s]+') with ordinality as t(p, o)
      where btrim(p) <> '';
      if exists (select 1 from unnest(v_parts) as x where x !~ '^\d{4}$') then
        raise exception '%', c_err using errcode = '22023';
      end if;
      select coalesce(jsonb_agg(d.x order by d.first_o), '[]'::jsonb) into v_list
      from (
        select x, min(o) as first_o
        from unnest(v_parts) with ordinality as u(x, o)
        group by x
      ) d;
      return p_row || jsonb_build_object('mccs', v_list);

    when 'merchants', 'exclusions' then
      if v_clear then
        return p_row - p_field;
      end if;
      select jsonb_agg(btrim(p) order by o) into v_list
      from regexp_split_to_table(p_raw, ',') with ordinality as t(p, o)
      where btrim(p) <> '';
      if v_list is null then
        return p_row - p_field;
      end if;
      return p_row || jsonb_build_object(p_field, v_list);

    when 'mcc_source' then
      if v_clear then
        return p_row - 'mccSource';
      end if;
      if btrim(p_raw) not in ('terms', 'network_default') then
        raise exception '%', c_err using errcode = '22023';
      end if;
      return p_row || jsonb_build_object('mccSource', btrim(p_raw));

    when 'cap_amount' then
      v_num := public.review_parse_non_neg_number(p_raw);
      if v_num is null and not v_clear then
        raise exception '%', c_err using errcode = '22023';
      end if;
      if v_num is null then
        return p_row - 'capMonthly' - 'capAnnual' - '_capAmount';
      end if;
      return (p_row - 'capMonthly' - 'capAnnual') || jsonb_build_object('_capAmount', v_num);

    when 'cap_period' then
      if v_clear then
        return p_row;
      end if;
      if btrim(p_raw) not in ('monthly', 'annual', 'statement') then
        raise exception '%', c_err using errcode = '22023';
      end if;
      return p_row || jsonb_build_object('_capPeriod', btrim(p_raw));

    when 'cap_group' then
      if v_clear then
        return p_row - 'capGroup';
      end if;
      return p_row || jsonb_build_object('capGroup', btrim(p_raw));

    when 'rate_after_cap', 'tier_threshold' then
      v_key := case p_field when 'rate_after_cap' then 'rateAfterCap' else 'tierThreshold' end;
      v_num := public.review_parse_non_neg_number(p_raw);
      if v_num is null and not v_clear then
        raise exception '%', c_err using errcode = '22023';
      end if;
      if v_num is null then
        return p_row - v_key;
      end if;
      return p_row || jsonb_build_object(v_key, v_num);

    when 'valid_from', 'valid_to' then
      v_key := case p_field when 'valid_from' then 'validFrom' else 'validTo' end;
      if v_clear then
        return p_row - v_key;
      end if;
      v_text := public.review_iso_date(p_raw);
      if v_text is null then
        raise exception '%', c_err using errcode = '22023';
      end if;
      return p_row || jsonb_build_object(v_key, v_text);

    when 'source_url' then
      if v_clear then
        return p_row - 'sourceUrl';
      end if;
      return p_row || jsonb_build_object('sourceUrl', btrim(p_raw));

    else
      raise exception '%', c_err using errcode = '22023';
  end case;
end;
$$;

-- Mirrors finalizeCap() in catalog-write-rules.ts.
create or replace function public.reward_finalize_cap(p_row jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_amount jsonb := p_row -> '_capAmount';
  v_row jsonb := p_row - '_capAmount' - '_capPeriod';
begin
  if v_amount is null or v_amount = 'null'::jsonb then
    return v_row;
  end if;
  if p_row ->> '_capPeriod' = 'annual' then
    return (v_row - 'capMonthly') || jsonb_build_object('capAnnual', v_amount);
  end if;
  return (v_row - 'capAnnual') || jsonb_build_object('capMonthly', v_amount);
end;
$$;

-- Mirrors findBaseIndex() in catalog-write-rules.ts (0-based; -1 = none).
create or replace function public.reward_find_base_index(p_rows jsonb, p_ext jsonb, p_claimed int[])
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cat text := p_ext ->> 'category';
  v_group text := nullif(p_ext ->> 'cap_group', '');
  v_tier jsonb := case when jsonb_typeof(p_ext -> 'tier_threshold') = 'number' then p_ext -> 'tier_threshold' end;
  v_row jsonb;
  v_i int;
  v_row_group text;
  v_row_tier jsonb;
  v_category_only int := -1;
begin
  for v_row, v_i in
    select e, (o - 1)::int
    from jsonb_array_elements(p_rows) with ordinality as t(e, o)
    order by o
  loop
    continue when v_i = any (p_claimed);
    continue when v_row ->> 'category' is distinct from v_cat;
    v_row_group := nullif(v_row ->> 'capGroup', '');
    v_row_tier := case when jsonb_typeof(v_row -> 'tierThreshold') = 'number' then v_row -> 'tierThreshold' end;
    continue when v_group is not null and v_row_group is not null and v_row_group <> v_group;
    continue when v_tier is not null and v_row_tier is not null and v_row_tier <> v_tier;
    if (v_group is null or v_row_group is not distinct from v_group)
       and (v_tier is null or v_row_tier is not distinct from v_tier) then
      return v_i;
    end if;
    if v_category_only < 0 then
      v_category_only := v_i;
    end if;
  end loop;
  return v_category_only;
end;
$$;

-- Mirrors applyRatesByCategory() in catalog-write-rules.ts (JS Map semantics:
-- a repeated category keeps its first position and its last value).
create or replace function public.reward_apply_rates_by_category(p_rows jsonb, p_cats text[], p_rates numeric[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cats text[] := array[]::text[];
  v_vals jsonb[] := array[]::jsonb[];
  v_row jsonb;
  v_p int;
  v_k int;
begin
  for v_row in
    select e from jsonb_array_elements(p_rows) with ordinality as t(e, o) order by o
  loop
    v_p := array_position(v_cats, v_row ->> 'category');
    if v_p is null then
      v_cats := array_append(v_cats, v_row ->> 'category');
      v_vals := array_append(v_vals, v_row);
    else
      v_vals[v_p] := v_row;
    end if;
  end loop;

  for v_k in 1 .. coalesce(cardinality(p_cats), 0)
  loop
    v_p := array_position(v_cats, p_cats[v_k]);
    if v_p is null then
      v_cats := array_append(v_cats, p_cats[v_k]);
      v_vals := array_append(v_vals, jsonb_build_object('category', p_cats[v_k], 'earnRate', p_rates[v_k]));
    else
      v_vals[v_p] := v_vals[v_p] || jsonb_build_object('earnRate', p_rates[v_k]);
    end if;
  end loop;

  if cardinality(v_vals) = 0 then
    return '[{"category":"other","earnRate":1}]'::jsonb;
  end if;
  return to_jsonb(v_vals);
end;
$$;

-- Mirrors promoDate() in catalog-write-offers.ts.
create or replace function public.reward_promo_date(p_fields jsonb, p_key text, p_fallback jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_date text;
begin
  if not (p_fields ? p_key) then
    if jsonb_typeof(p_fallback) = 'string' and p_fallback #>> '{}' <> '' then
      return p_fallback #>> '{}';
    end if;
    return null;
  end if;
  if public.review_value_is_clear(p_fields ->> p_key) then
    return null;
  end if;
  v_date := public.review_iso_date(p_fields ->> p_key);
  if v_date is null then
    raise exception 'card_op reward_categories does not match review_fields' using errcode = '22023';
  end if;
  return v_date;
end;
$$;

-- Mirrors promoIdentity() in catalog-write-offers.ts.
create or replace function public.reward_promo_identity(p_row jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat(
    p_row ->> 'category', '|',
    coalesce(p_row ->> 'validFrom', ''), '|',
    coalesce(p_row ->> 'validTo', ''), '|',
    coalesce(p_row ->> 'quote', '')
  );
$$;

-- Mirrors buildPromoRows() in catalog-write-offers.ts. p_fields maps the saved
-- promotion.<i>.<field> suffixes to their raw values.
create or replace function public.reward_promo_rows(p_fields jsonb, p_base jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  c_err constant text := 'card_op reward_categories does not match review_fields';
  v_summary text;
  v_raw text;
  v_rate numeric;
  v_from text;
  v_to text;
  v_src text;
  v_cats jsonb;
  v_cat jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  v_summary := case when p_fields ? 'summary' then p_fields ->> 'summary' else p_base ->> 'summary' end;
  if public.review_value_is_clear(v_summary) then
    return '[]'::jsonb;
  end if;

  if p_fields ? 'rate' then
    v_raw := p_fields ->> 'rate';
    v_rate := public.review_parse_non_neg_number(v_raw);
    if v_rate is null and not public.review_value_is_clear(v_raw) then
      raise exception '%', c_err using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_base -> 'rate') = 'number' then
    v_rate := (p_base ->> 'rate')::numeric;
  end if;
  -- Points-only promotions are not earn rates.
  if v_rate is null then
    return '[]'::jsonb;
  end if;

  v_from := public.reward_promo_date(p_fields, 'valid_from', p_base -> 'valid_from');
  v_to := public.reward_promo_date(p_fields, 'valid_to', p_base -> 'valid_to');

  if not (p_fields ? 'source_url') then
    if jsonb_typeof(p_base -> 'source_url') = 'string' and p_base ->> 'source_url' <> '' then
      v_src := p_base ->> 'source_url';
    end if;
  elsif not public.review_value_is_clear(p_fields ->> 'source_url') then
    v_src := btrim(p_fields ->> 'source_url');
  end if;

  if not (p_fields ? 'categories') then
    if jsonb_typeof(p_base -> 'categories') = 'array' and jsonb_array_length(p_base -> 'categories') > 0 then
      v_cats := p_base -> 'categories';
    end if;
  elsif not public.review_value_is_clear(p_fields ->> 'categories') then
    select jsonb_agg(to_jsonb(btrim(p)) order by o) into v_cats
    from regexp_split_to_table(p_fields ->> 'categories', ',') with ordinality as t(p, o)
    where btrim(p) <> '';
  end if;
  v_cats := coalesce(v_cats, '["other"]'::jsonb);

  for v_cat in
    select c from jsonb_array_elements(v_cats) with ordinality as t(c, o) order by o
  loop
    v_out := v_out || jsonb_build_array(
      jsonb_build_object('category', v_cat, 'earnRate', v_rate)
      || case when p_base ? 'quote' then jsonb_build_object('quote', p_base -> 'quote') else '{}'::jsonb end
      || case when v_from is not null then jsonb_build_object('validFrom', v_from) else '{}'::jsonb end
      || case when v_to is not null then jsonb_build_object('validTo', v_to) else '{}'::jsonb end
      || case when v_src is not null then jsonb_build_object('sourceUrl', v_src) else '{}'::jsonb end
    );
  end loop;
  return v_out;
end;
$$;

-- Mirrors applyPromotions() in catalog-write-offers.ts.
create or replace function public.reward_apply_promotions(p_rows jsonb, p_review_fields jsonb, p_extracted jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_err constant text := 'card_op reward_categories does not match review_fields';
  v_promos jsonb := p_extracted -> 'promotions';
  v_extra jsonb := '[]'::jsonb;
  v_i int;
  v_fields jsonb;
  v_base jsonb;
  v_ids text[];
begin
  if not exists (
    select 1 from public.review_decisions(p_review_fields) r where starts_with(r.key, 'promotion.')
  ) then
    return p_rows;
  end if;
  if jsonb_typeof(v_promos) is distinct from 'array' or jsonb_array_length(v_promos) = 0 then
    raise exception '%', c_err using errcode = '22023';
  end if;

  for v_i, v_fields in
    select (s.m)[1]::int, jsonb_object_agg((s.m)[2], s.v)
    from (
      select regexp_match(r.key, '^promotion\.(\d+)\.(.+)$') as m, r.value as v
      from public.review_decisions(p_review_fields) r
    ) s
    where s.m is not null
    group by 1
    order by 1
  loop
    v_base := v_promos -> v_i;
    if v_base is null or jsonb_typeof(v_base) <> 'object' then
      raise exception '%', c_err using errcode = '22023';
    end if;
    v_extra := v_extra || public.reward_promo_rows(v_fields, v_base);
  end loop;

  if jsonb_array_length(v_extra) = 0 then
    return p_rows;
  end if;
  select array_agg(public.reward_promo_identity(e)) into v_ids from jsonb_array_elements(v_extra) as e;
  return coalesce(
    (
      select jsonb_agg(e order by o)
      from jsonb_array_elements(p_rows) with ordinality as t(e, o)
      where not (public.reward_promo_identity(e) = any (v_ids))
    ),
    '[]'::jsonb
  ) || v_extra;
end;
$$;

-- Mirrors applyEarnRates() then applyPromotions() (applyRewardRules in
-- catalog-write.ts). p_base is the live card's reward_categories ([] on insert).
create or replace function public.derive_reward_categories(p_base jsonb, p_review_fields jsonb, p_extracted jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_err constant text := 'card_op reward_categories does not match review_fields';
  v_rows jsonb := '[]'::jsonb;
  v_d record;
  v_m text[];
  v_ov_cats text[] := array[]::text[];
  v_ov_rates numeric[] := array[]::numeric[];
  v_touched int[] := array[]::int[];
  v_claimed int[] := array[]::int[];
  v_applied text[] := array[]::text[];
  v_ext_rates jsonb := p_extracted -> 'earn_rates';
  v_ext jsonb;
  v_ext_cat text;
  v_ext_rate numeric;
  v_max numeric;
  v_num numeric;
  v_rate numeric;
  v_override numeric;
  v_pos int;
  v_idx int;
  v_i int;
  v_k int;
  v_row jsonb;
begin
  if jsonb_typeof(p_base) = 'array' then
    select coalesce(jsonb_agg(s.n order by s.o), '[]'::jsonb) into v_rows
    from (
      select public.reward_normalize_row(e) as n, o
      from jsonb_array_elements(p_base) with ordinality as t(e, o)
    ) s
    where s.n is not null;
  end if;

  -- rateOverrides() and collectTouchedIndices()
  for v_d in select r.key, r.value from public.review_decisions(p_review_fields) r order by r.pos
  loop
    if starts_with(v_d.key, 'earn_rate.') then
      v_num := public.review_parse_non_neg_number(v_d.value);
      if length(v_d.key) = length('earn_rate.') or v_num is null then
        raise exception '%', c_err using errcode = '22023';
      end if;
      v_ov_cats := array_append(v_ov_cats, substr(v_d.key, length('earn_rate.') + 1));
      v_ov_rates := array_append(v_ov_rates, v_num);
    else
      v_m := regexp_match(v_d.key, '^earn_rates\[(\d+)\]\.(.+)$');
      if v_m is not null and not (v_m[1]::int = any (v_touched)) then
        v_touched := array_append(v_touched, v_m[1]::int);
      end if;
    end if;
  end loop;

  if cardinality(v_touched) = 0 then
    if cardinality(v_ov_cats) > 0 then
      v_rows := public.reward_apply_rates_by_category(v_rows, v_ov_cats, v_ov_rates);
    end if;
    return public.reward_apply_promotions(v_rows, p_review_fields, p_extracted);
  end if;

  if jsonb_typeof(v_ext_rates) is distinct from 'array' or jsonb_array_length(v_ext_rates) = 0 then
    raise exception '%', c_err using errcode = '22023';
  end if;
  select array_agg(x order by x) into v_touched from unnest(v_touched) as x;

  foreach v_i in array v_touched
  loop
    v_ext := v_ext_rates -> v_i;
    if v_ext is null or jsonb_typeof(v_ext) <> 'object' then
      raise exception '%', c_err using errcode = '22023';
    end if;
    v_ext_cat := v_ext ->> 'category';
    v_ext_rate := case when jsonb_typeof(v_ext -> 'rate') = 'number' then (v_ext ->> 'rate')::numeric end;

    -- rateForTouchedRow(): earn_rate.<cat> applies to the category's max tier only.
    v_rate := null;
    v_override := null;
    v_pos := array_position(v_ov_cats, v_ext_cat);
    if v_pos is not null then
      v_override := v_ov_rates[v_pos];
      select max(case when jsonb_typeof(e -> 'rate') = 'number' then (e ->> 'rate')::numeric end)
        into v_max
      from jsonb_array_elements(v_ext_rates) as e
      where e ->> 'category' = v_ext_cat;
      v_rate := case when v_ext_rate is not distinct from v_max then v_override else v_ext_rate end;
    end if;

    -- mergeTouchedIndex()
    v_idx := public.reward_find_base_index(v_rows, v_ext, v_claimed);
    if v_idx < 0 then
      v_rows := v_rows || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'category', v_ext -> 'category',
        'earnRate', coalesce(to_jsonb(v_rate), v_ext -> 'rate')
      )));
      v_idx := jsonb_array_length(v_rows) - 1;
    end if;
    v_claimed := array_append(v_claimed, v_idx);

    v_row := v_rows -> v_idx;
    for v_d in select r.key, r.value from public.review_decisions(p_review_fields) r order by r.pos
    loop
      v_m := regexp_match(v_d.key, '^earn_rates\[(\d+)\]\.(.+)$');
      continue when v_m is null or v_m[1]::int <> v_i;
      v_row := public.reward_apply_indexed_field(v_row, v_m[2], v_d.value);
    end loop;
    v_row := public.reward_finalize_cap(v_row);
    if v_rate is not null then
      v_row := v_row || jsonb_build_object('earnRate', v_rate);
      if v_rate = v_override then
        v_applied := array_append(v_applied, v_ext_cat);
      end if;
    end if;
    v_rows := jsonb_set(v_rows, array[v_idx::text], v_row);
  end loop;

  -- applyRemainingRateOverrides()
  for v_k in 1 .. cardinality(v_ov_cats)
  loop
    continue when v_ov_cats[v_k] = any (v_applied);
    select (o - 1)::int into v_idx
    from jsonb_array_elements(v_rows) with ordinality as t(e, o)
    where e ->> 'category' = v_ov_cats[v_k] and not ((o - 1)::int = any (v_claimed))
    order by o
    limit 1;
    if v_idx is null then
      select (o - 1)::int into v_idx
      from jsonb_array_elements(v_rows) with ordinality as t(e, o)
      where e ->> 'category' = v_ov_cats[v_k]
      order by o
      limit 1;
    end if;
    if v_idx is null then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('category', v_ov_cats[v_k], 'earnRate', v_ov_rates[v_k]));
    else
      v_rows := jsonb_set(v_rows, array[v_idx::text], (v_rows -> v_idx) || jsonb_build_object('earnRate', v_ov_rates[v_k]));
    end if;
    v_applied := array_append(v_applied, v_ov_cats[v_k]);
  end loop;

  if jsonb_array_length(v_rows) = 0 then
    v_rows := '[{"category":"other","earnRate":1}]'::jsonb;
  end if;
  return public.reward_apply_promotions(v_rows, p_review_fields, p_extracted);
end;
$$;

-- reward_categories must equal the derivation. p_existing is null on insert,
-- where an empty result falls back to one "other" row (buildNewWrite).
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
  v_expected jsonb;
begin
  v_expected := public.derive_reward_categories(coalesce(p_existing, '[]'::jsonb), p_review_fields, p_extracted);
  if p_existing is null and jsonb_array_length(v_expected) = 0 then
    v_expected := '[{"category":"other","earnRate":1}]'::jsonb;
  end if;
  if p_categories is distinct from v_expected then
    raise exception 'card_op reward_categories does not match review_fields' using errcode = '22023';
  end if;
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
    v_raw := public.review_saved_raw(p_review_fields, 'welcome_bonus.points');
    if public.review_value_is_clear(v_raw) then
      v_cleared := true;
      if v_offer ? 'points'
         and v_offer -> 'points' is not null
         and v_offer -> 'points' <> 'null'::jsonb then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    else
      v_expected := public.review_parse_non_neg_number(v_raw, true);
      if v_expected is null
         or (v_offer ->> 'points')::numeric is distinct from v_expected then
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
    v_raw := public.review_saved_raw(p_review_fields, 'welcome_bonus.rate');
    if public.review_value_is_clear(v_raw) then
      if v_offer ? 'rate'
         and v_offer -> 'rate' is not null
         and v_offer -> 'rate' <> 'null'::jsonb then
        raise exception 'card_op welcome_offer does not match review_fields'
          using errcode = '22023';
      end if;
    else
      v_expected := public.review_parse_non_neg_number(v_raw);
      if v_expected is null
         or (v_offer ->> 'rate')::numeric is distinct from v_expected then
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
    if public.review_value_is_clear(v_raw) then
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
    if public.review_value_is_clear(v_raw) then
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
    if public.review_value_is_clear(v_raw) then
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

    if public.review_field_saved(p_review_fields, 'annual_fee') then
      v_allowed := v_allowed || array['annual_fee'];
      v_fee := public.review_parse_non_neg_number(public.review_saved_raw(p_review_fields, 'annual_fee'));
      if v_fee is null
         or not (v_payload ? 'annual_fee')
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

    if public.review_field_saved(p_review_fields, 'annual_fee') then
      v_fee := public.review_parse_non_neg_number(public.review_saved_raw(p_review_fields, 'annual_fee'));
      if v_fee is null
         or (v_payload ->> 'annual_fee')::numeric is distinct from v_fee then
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
revoke all on function public.review_parse_non_neg_number(text, boolean) from public, anon, authenticated;
revoke all on function public.review_has_saved_prefix(jsonb, text) from public, anon, authenticated;
revoke all on function public.map_review_network(text) from public, anon, authenticated;
revoke all on function public.validate_reward_categories(jsonb) from public, anon, authenticated;
revoke all on function public.review_decisions(jsonb) from public, anon, authenticated;
revoke all on function public.review_iso_date(text) from public, anon, authenticated;
revoke all on function public.reward_normalize_row(jsonb) from public, anon, authenticated;
revoke all on function public.reward_apply_indexed_field(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.reward_finalize_cap(jsonb) from public, anon, authenticated;
revoke all on function public.reward_find_base_index(jsonb, jsonb, int[]) from public, anon, authenticated;
revoke all on function public.reward_apply_rates_by_category(jsonb, text[], numeric[]) from public, anon, authenticated;
revoke all on function public.reward_promo_date(jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.reward_promo_identity(jsonb) from public, anon, authenticated;
revoke all on function public.reward_promo_rows(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.reward_apply_promotions(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.derive_reward_categories(jsonb, jsonb, jsonb) from public, anon, authenticated;
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
