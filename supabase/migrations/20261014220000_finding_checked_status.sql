-- Keep unchanged cards out of the review queue. A finding whose diff against
-- the catalog has no changes is stored as review_status = 'checked' (set by the
-- crawler, never by a reviewer) instead of 'pending'. checked_at records when
-- the crawler compared the finding against `cards`, so the last time a catalog
-- card was confirmed unchanged is the newest checked_at for its linked_card_id.

alter table public.card_findings
  add column if not exists checked_at timestamptz;

comment on column public.card_findings.checked_at is
  'When the crawler diffed this finding against cards. Set by the crawler; not writable by console roles.';

alter table public.card_findings
  drop constraint if exists card_findings_review_status_check;
alter table public.card_findings
  add constraint card_findings_review_status_check
    check (review_status in ('pending', 'checked', 'approved', 'rejected', 'ignored'));

-- Existing rows were diffed when they were inserted.
update public.card_findings
  set checked_at = created_at
  where checked_at is null and diff_kind is not null;

update public.card_findings
  set review_status = 'checked'
  where review_status = 'pending' and diff_kind = 'unchanged';

-- No-change findings never wait for review; 'checked' is only for them.
alter table public.card_findings
  drop constraint if exists card_findings_unchanged_not_pending;
alter table public.card_findings
  add constraint card_findings_unchanged_not_pending
    check (diff_kind is distinct from 'unchanged' or review_status <> 'pending');

alter table public.card_findings
  drop constraint if exists card_findings_checked_is_unchanged;
alter table public.card_findings
  add constraint card_findings_checked_is_unchanged
    check (review_status <> 'checked' or (diff_kind = 'unchanged' and checked_at is not null));
