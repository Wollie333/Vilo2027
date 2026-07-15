-- Finding #11: guest post creation checked the quota and recorded the usage row
-- in SEPARATE statements, so two concurrent posts both passed the under-cap check
-- and both posted — exceeding the daily/monthly cap.
--
-- This function serializes the check+record per user with a transaction-level
-- advisory lock: it re-runs check_guest_post_quota UNDER the lock and, only if
-- still allowed, records the usage row. Two concurrent posts can no longer both
-- read an under-cap count — the second waits, then sees the first's usage row and
-- is refused. SECURITY DEFINER so the usage insert isn't blocked by RLS; callable
-- by authenticated (the posting guest).
create or replace function public.record_guest_post_and_check(
  p_user_id uuid,
  p_post_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
begin
  -- Serialize per user so concurrent posts can't both slip past the cap.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  v_check := public.check_guest_post_quota(p_user_id);
  if coalesce((v_check->>'allowed')::boolean, true) = false then
    return v_check;  -- over quota — the caller rolls back the just-created post
  end if;
  insert into public.looking_for_usage (user_id, action, post_id)
    values (p_user_id, 'guest_post', p_post_id);
  return v_check;
end;
$$;

revoke all on function public.record_guest_post_and_check(uuid, uuid)
  from anon;
grant execute on function public.record_guest_post_and_check(uuid, uuid)
  to authenticated;
