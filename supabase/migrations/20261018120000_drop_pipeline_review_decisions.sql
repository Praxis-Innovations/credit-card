-- CR5 retired apps/api/src/data-pipeline; review now lives on
-- card_findings / merchant_code_findings (AD2 / AD6). Drop the unused
-- fingerprint review table. Keep reviewed_by on catalog rows — still used.

drop index if exists public.pipeline_review_decisions_status_idx;
drop table if exists public.pipeline_review_decisions;
