-- AD2: approving a finding writes accepted values to public.cards in the same
-- transaction as the finding decision (and thus the admin_audit row). There is
-- no separate promote step. Bulk approve (when present) calls this once per row.

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

  v_card_id := v_finding.linked_card_id;

  if p_card_op is not null then
    if jsonb_typeof(p_card_op) <> 'object' then
      raise exception 'card_op must be a json object' using errcode = '22023';
    end if;
    v_op := p_card_op ->> 'op';

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
      if v_network is not null and v_network not in ('Visa', 'Mastercard', 'Amex') then
        raise exception 'invalid network' using errcode = '22023';
      end if;
      if v_annual_fee is null or v_annual_fee < 0 then
        raise exception 'invalid annual_fee' using errcode = '22023';
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
        case
          when v_welcome_offer is null or v_welcome_offer = 'null'::jsonb then null
          else v_welcome_offer
        end,
        v_network,
        v_last_verified,
        now(),
        v_verified_at,
        'verified'::public.catalog_status
      );

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

      if not found then
        raise exception 'catalog card % not found', v_card_id using errcode = 'P0002';
      end if;

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
  'Approve a pending finding and optionally write accepted values to cards in one transaction (AD2).';

revoke all on function public.approve_finding_to_catalog(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.approve_finding_to_catalog(uuid, jsonb, jsonb)
  to authenticated;

-- Validators still cannot touch cards directly; only via the RPC above.
-- (No INSERT/UPDATE policies on cards — service role and security definer only.)
