-- BREAK-GLASS: Re-grant super_admin to the founder account.
--
-- Use this when you've locked yourself out of the admin panel (e.g. accidentally
-- deactivated your own platform_staff row, or migrations got out of sync).
--
-- HOW TO RUN
-- Connect to the database as the postgres superuser (service-role bypasses RLS
-- but cannot reach `auth.users`-linked DML in some setups):
--
--   Local:    psql "$DATABASE_URL_LOCAL" -f supabase/scripts/grant-super-admin.sql
--   Hosted:   supabase db remote query --file supabase/scripts/grant-super-admin.sql
--
-- You can override the founder email by setting the psql variable :email
--
--   psql ... -v email=someone@vilo.com -f grant-super-admin.sql

\set ON_ERROR_STOP on
\if :{?email}
\else
  \set email '\'wollie333@gmail.com\''
\endif

DO $$
DECLARE
  v_email text  := :'email';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM public.user_profiles
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user_profiles row found for %. Sign up first, then re-run.', v_email;
  END IF;

  INSERT INTO public.platform_staff (user_id, role_id, is_active, accepted_at)
  VALUES (v_user_id, 'super_admin', true, now())
  ON CONFLICT (user_id) DO UPDATE
    SET role_id = 'super_admin',
        is_active = true,
        updated_at = now();

  RAISE NOTICE 'super_admin granted to % (user_id=%)', v_email, v_user_id;
END $$;
