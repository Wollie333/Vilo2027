-- TEMPORARY: return a function's source so we can review app_purge_user_account
-- before running it on the one account we must not break (the super admin).
-- Dropped again in a follow-up migration.
create or replace function public._diag_func_src(p_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select string_agg(pg_get_functiondef(p.oid), E'\n\n---\n\n')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = p_name and n.nspname = 'public';
$$;
revoke all on function public._diag_func_src(text) from public;
