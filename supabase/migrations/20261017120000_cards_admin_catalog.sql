-- AD4: console browse of public.cards (all statuses) + Retire card.
-- Retire reuses catalog_status = rejected (no separate retired value): the card
-- drops out of the public API (verified-only) and stays visible in the console.
-- Manual field edits are out of scope; values change only through the review queue.

-- Console roles may read every catalog status (public clients still see verified only).
drop policy if exists cards_select_console on public.cards;
create policy cards_select_console on public.cards
  for select to authenticated
  using ((select public.is_admin('viewer')));

-- History on Card detail: any console role may read the audit log.
drop policy if exists admin_audit_select on public.admin_audit;
create policy admin_audit_select on public.admin_audit
  for select to authenticated
  using ((select public.is_admin('viewer')));

create or replace function public.retire_card(p_card_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_actor text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user);
begin
  if not public.is_admin('admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if nullif(btrim(p_card_id), '') is null then
    raise exception 'card id is required' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'issuer', c.issuer,
    'status', c.status
  )
  into v_before
  from public.cards c
  where c.id = p_card_id
  for update;

  if v_before is null then
    return null;
  end if;

  if (v_before ->> 'status') = 'rejected' then
    return jsonb_build_object('id', p_card_id, 'status', 'rejected', 'already', true);
  end if;

  update public.cards
  set status = 'rejected'::public.catalog_status,
      reviewed_by = v_actor
  where id = p_card_id;

  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'issuer', c.issuer,
    'status', c.status
  )
  into v_after
  from public.cards c
  where c.id = p_card_id;

  insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
  values (v_actor, 'card.retire', 'cards', p_card_id, v_before, v_after);

  return v_after;
end;
$$;

revoke all on function public.retire_card(text) from public, anon;
grant execute on function public.retire_card(text) to authenticated;

comment on function public.retire_card(text) is
  'Set a catalog card to rejected (retired from the live API). Admin only; audited (AD4).';
