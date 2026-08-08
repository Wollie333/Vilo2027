-- TEMPORARY diagnostic helper: figure out WHY deleting a given auth user fails
-- with GoTrue's opaque "Database error deleting user". It attempts the real
-- DELETE FROM auth.users (exercising the full cascade), captures the exact
-- failing constraint/table via GET STACKED DIAGNOSTICS, then ALWAYS rolls the
-- delete back. Non-destructive. Dropped again in a follow-up migration.

create or replace function public._diag_try_delete_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_msg text;
  v_detail text;
  v_constraint text;
  v_table text;
  v_schema text;
begin
  begin
    delete from auth.users where id = p_user_id;
    -- Force the enclosing sub-transaction to roll the delete back.
    raise exception using errcode = 'P0001', message = '__WOULD_SUCCEED__';
  exception
    when others then
      get stacked diagnostics
        v_msg = message_text,
        v_detail = pg_exception_detail,
        v_constraint = constraint_name,
        v_table = table_name,
        v_schema = schema_name;
      if v_msg = '__WOULD_SUCCEED__' then
        return 'WOULD SUCCEED — no block (delete rolled back)';
      end if;
      return format(
        'ERROR: %s | DETAIL: %s | CONSTRAINT: %s | TABLE: %s.%s',
        v_msg, coalesce(v_detail, ''), coalesce(v_constraint, ''),
        coalesce(v_schema, ''), coalesce(v_table, '')
      );
  end;
end;
$$;

-- Do NOT expose this to public/anon/authenticated. Service role bypasses.
revoke all on function public._diag_try_delete_user(uuid) from public;
