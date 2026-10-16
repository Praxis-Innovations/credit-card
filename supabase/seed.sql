-- Local-only seed data (applied on `supabase start` / `supabase db reset`).
-- Never run against the shared hosted project. Passwords and the E2E API key
-- below are fixtures for Playwright — not production secrets.

-- ---------------------------------------------------------------------------
-- E2E API key (SHA-256 of plaintext `nt_e2e_local_only_not_for_prod`)
-- ---------------------------------------------------------------------------
insert into public.api_keys (
  key_hash, key_prefix, owner_label, tier, rate_limit_per_minute, active
) values (
  '2add3fdd894c65a8c8fd5bae650550e567156b65809641b0933d102886d99829',
  'nt_e2e_',
  'NorthTap E2E (local only)',
  'internal'::public.api_key_tier,
  600,
  true
)
on conflict (key_hash) do update set
  owner_label = excluded.owner_label,
  tier = excluded.tier,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Local auth users (email/password + one Google-linked admin)
-- Password for both: local-e2e-password
-- Token columns must be '' (not NULL) — GoTrue scans them as Go strings.
-- ---------------------------------------------------------------------------
do $$
declare
  app_id uuid := '11111111-1111-4111-8111-111111111111';
  admin_id uuid := '22222222-2222-4222-8222-222222222222';
  app_email text := 'user@northtap.test';
  admin_email text := 'admin@northtap.test';
  pw text := extensions.crypt('local-e2e-password', extensions.gen_salt('bf'));
begin
  -- App user (email identity only)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    app_id,
    'authenticated',
    'authenticated',
    app_email,
    pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"E2E App User"}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    '', '', '',
    '', false, false
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    app_id,
    app_id,
    app_id::text,
    jsonb_build_object(
      'sub', app_id::text,
      'email', app_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    identity_data = excluded.identity_data,
    updated_at = now();

  -- Admin user: Google identity + password so Playwright can sign in without OAuth.
  -- JWT app_metadata.providers includes google → public.is_admin() accepts it.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token,
    reauthentication_token, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    admin_id,
    'authenticated',
    'authenticated',
    admin_email,
    pw,
    now(),
    '{"provider":"google","providers":["google"]}'::jsonb,
    '{"full_name":"E2E Admin","avatar_url":null}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    '', '', '',
    '', false, false
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    '33333333-3333-4333-8333-333333333333'::uuid,
    admin_id,
    'google-e2e-admin-northtap',
    jsonb_build_object(
      'sub', 'google-e2e-admin-northtap',
      'email', admin_email,
      'email_verified', true,
      'name', 'E2E Admin',
      'full_name', 'E2E Admin',
      'provider_id', 'google-e2e-admin-northtap'
    ),
    'google',
    now(),
    now(),
    now()
  )
  on conflict (provider_id, provider) do update set
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();
end $$;

-- Allow-list the local Google admin (production migration keeps the real owner email).
insert into public.admin_users (email, role, active)
values ('admin@northtap.test', 'admin', true)
on conflict (email) do update set
  role = excluded.role,
  active = excluded.active;
