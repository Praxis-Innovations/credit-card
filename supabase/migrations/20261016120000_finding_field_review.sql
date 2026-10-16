-- Field-by-field review (AD1): store which fields the reviewer saves, any
-- corrected values, and write those decisions into admin_audit. Approve and
-- next makes accepted values live; the cards write is AD2 (called from the
-- admin approve action — no separate promote step).

alter table public.card_findings
  add column if not exists review_fields jsonb
    check (review_fields is null or jsonb_typeof(review_fields) = 'object');

comment on column public.card_findings.review_fields is
  'Per-field save/edit decisions from the review card. Shape: { fields: [{ key, save, page_value, value }] }. Null until a human decides.';

-- Validators may write the field decisions with the status change.
grant update (review_fields) on table public.card_findings to authenticated;

-- Extend the audit payload with field decisions and a compact edits list
-- (page_value → value when they differ). Extraction stays on card_findings.
create or replace function public.audit_finding_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edits jsonb := '[]'::jsonb;
begin
  if new.review_status is distinct from old.review_status then
    if new.review_fields is not null and jsonb_typeof(new.review_fields -> 'fields') = 'array' then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', f->>'key',
            'from', f->>'page_value',
            'to', f->>'value'
          )
          order by f->>'key'
        ),
        '[]'::jsonb
      )
      into v_edits
      from jsonb_array_elements(new.review_fields -> 'fields') as f
      where coalesce(f->>'page_value', '') is distinct from coalesce(f->>'value', '');
    end if;

    insert into public.admin_audit (actor_email, action, entity, entity_id, before, after)
    values (
      coalesce(nullif(auth.jwt() ->> 'email', ''), 'system:' || session_user),
      'finding.' || case new.review_status
        when 'approved' then 'approve'
        when 'rejected' then 'reject'
        else new.review_status
      end,
      'card_findings',
      new.id::text,
      jsonb_build_object('review_status', old.review_status),
      jsonb_build_object(
        'review_status', new.review_status,
        'review_note', new.review_note,
        'review_fields', new.review_fields,
        'edits', v_edits,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at,
        'run_id', new.run_id,
        'card_name', new.card_name,
        'diff_kind', new.diff_kind,
        'linked_card_id', new.linked_card_id
      )
    );
  end if;
  return new;
end
$$;

revoke all on function public.audit_finding_review() from public, anon, authenticated;
