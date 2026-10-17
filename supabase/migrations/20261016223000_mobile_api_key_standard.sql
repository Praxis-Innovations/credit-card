-- Demote the Expo / mobile client API key from internal (600/min) to standard
-- (60/min). Anything shipped via EXPO_PUBLIC_* is extractable from the client
-- binary; internal-tier keys belong only in server/CI env, not the mobile app.
-- Hash unchanged (app unreleased); rotate plaintext separately if ever public.

update public.api_keys
set
  owner_label = 'NorthTap Expo (mobile standard)',
  tier = 'standard'::public.api_key_tier,
  rate_limit_per_minute = 60
where key_hash = '08f44c4913063e05e5dcb4ff47f04f45eb197a07e34418427e5b23360e372183';
