-- Admin console review queue: record a reviewer's decision on a crawler
-- finding. Approval here ONLY records the decision; promotion into public.cards
-- is a separate, later step. reviewed_by / reviewed_at already exist on
-- card_findings (20261013120000); this adds the reviewer's note, tightens who
-- can move a finding out of 'pending', and writes every decision to
-- admin_audit.

alter table public.card_findings
  add column if not exists review_note text
    check (review_note is null or length(review_note) <= 1000);

-- A rejection must say why.
alter table public.card_findings
  drop constraint if exists card_findings_rejected_has_note;
alter table public.card_findings
  add constraint card_findings_rejected_has_note
    check (review_status <> 'rejected' or nullif(btrim(review_note), '') is not null);

-- Validators (and admins) may write the decision columns and nothing else.
grant update (review_note) on table public.card_findings to authenticated;

-- A finding can be reviewed once: only a pending row is updatable, and the
-- new status must be a decision a human can make ('ignored' stays
-- service-side). Same is_admin('validator') floor as before.
drop policy if exists card_findings_update on public.card_findings;
create policy card_findings_update on public.card_findings
  for update to authenticated
  using ((select public.is_admin('validator')) and review_status = 'pending')
  with check ((select public.is_admin('validator')) and review_status in ('approved', 'rejected'));

-- The reviewer identity and time come from the verified JWT, not the client.
create or replace function public.stamp_finding_review()
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

drop trigger if exists card_findings_stamp_review on public.card_findings;
create trigger card_findings_stamp_review
  before update on public.card_findings
  for each row execute function public.stamp_finding_review();

-- Append-only audit of review decisions. The finding's extraction payload is
-- deliberately not copied into the log; it stays on card_findings.
create or replace function public.audit_finding_review()
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
revoke all on function public.stamp_finding_review() from public, anon, authenticated;

drop trigger if exists card_findings_audit_review on public.card_findings;
create trigger card_findings_audit_review
  after update on public.card_findings
  for each row execute function public.audit_finding_review();
