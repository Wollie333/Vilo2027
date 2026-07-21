-- Does the CALLING user have a password set?
--
-- Needed for re-authentication on sensitive changes. Most Wielo accounts are
-- passwordless (magic-link), and those users have no "current password" to be
-- asked for — so the UI has to know which of the two flows to show, and the
-- server has to know whether the absence of a current password is legitimate.
--
-- Deliberately takes NO ARGUMENTS: it can only ever answer for auth.uid(), so
-- there is no id to tamper with and nothing to enumerate. It leaks one bit
-- about yourself and nothing about anyone else.
create or replace function public.current_user_has_password()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = auth.uid()
       and u.encrypted_password is not null
       and u.encrypted_password <> ''
  );
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC, so revoking from `anon` alone is a
-- no-op — revoke from PUBLIC and grant back only to signed-in callers.
revoke execute on function public.current_user_has_password() from public;
grant execute on function public.current_user_has_password() to authenticated;

comment on function public.current_user_has_password() is
  'True when the calling user has a password set. Drives whether a sensitive change asks for the current password or sends a set-password email. No arguments by design — answers only for auth.uid().';
