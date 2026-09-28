-- 'generated': a neutral card render we produce ourselves (no issuer art).
-- Kept in its own migration: a new enum value can't be referenced in the same
-- transaction that adds it (see 20260927200001_card_art_dev_sources.sql).
alter type public.asset_rights_status add value if not exists 'generated';

comment on type public.asset_rights_status is
  'licensed / issuer_provided = cleared for display; generated = our own neutral render, always servable; placeholder = no asset (clients render fallback); unknown = provenance not established, served only when NORTHTAP_SERVE_UNLICENSED_ASSETS=true (dev).';
