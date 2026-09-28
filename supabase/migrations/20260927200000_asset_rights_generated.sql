-- 'generated': a neutral card illustration we produce ourselves (no issuer art).
-- Kept in its own migration: a new enum value can't be referenced in the same
-- transaction that adds it (see 20260927210000_cards_generated_illustrations.sql).
alter type public.asset_rights_status add value if not exists 'generated';
