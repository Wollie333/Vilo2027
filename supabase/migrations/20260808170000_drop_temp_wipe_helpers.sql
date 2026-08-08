-- Drop the temporary helpers used during the vanilla-reset work:
--   _wipe_platform_noise() — one-shot truncate of platform "dashboard noise"
--   _diag_func_src()       — read function source to review app_purge_user_account
-- Both were SECURITY DEFINER and have served their purpose; remove them so no
-- powerful ad-hoc teardown/introspection helper lingers in the database.

drop function if exists public._wipe_platform_noise();
drop function if exists public._diag_func_src(text);
