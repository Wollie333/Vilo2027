-- Atomic + idempotent credit movement. The single write-path for the credit
-- wallet: ensures the wallet row exists, applies the delta under a row lock,
-- guards against going negative (clean 'INSUFFICIENT_CREDITS'), and appends the
-- ledger row with the resulting balance. Idempotent when (ref_type, ref_id, kind)
-- is supplied — a repeated grant (webhook + return settle) applies once.
-- SECURITY DEFINER so the app's service-role engine calls it; RLS keeps clients
-- read-only on the underlying tables.

create or replace function public.apply_wielo_credit(
  p_host_id uuid,
  p_purpose text,
  p_delta integer,
  p_kind text,
  p_reason text default null,
  p_ref_type text default null,
  p_ref_id text default null,
  p_created_by uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  -- Idempotency: this exact movement already recorded → return current balance.
  if p_ref_id is not null and p_ref_type is not null then
    if exists (
      select 1 from wielo_credit_ledger
      where ref_type = p_ref_type and ref_id = p_ref_id and kind = p_kind
    ) then
      select coalesce(balance, 0) into v_balance
        from wielo_credit_wallet
        where host_id = p_host_id and purpose = p_purpose;
      return coalesce(v_balance, 0);
    end if;
  end if;

  -- Pre-guard debits so the caller gets a clean error, not a CHECK violation.
  if p_delta < 0 then
    select coalesce(balance, 0) into v_balance
      from wielo_credit_wallet
      where host_id = p_host_id and purpose = p_purpose
      for update;
    if coalesce(v_balance, 0) + p_delta < 0 then
      raise exception 'INSUFFICIENT_CREDITS';
    end if;
  end if;

  -- Ensure the wallet exists, then apply the delta atomically.
  insert into wielo_credit_wallet (host_id, purpose, balance)
    values (p_host_id, p_purpose, 0)
  on conflict (host_id, purpose) do nothing;

  update wielo_credit_wallet
    set balance = balance + p_delta
    where host_id = p_host_id and purpose = p_purpose
    returning balance into v_balance;

  insert into wielo_credit_ledger (
    host_id, purpose, delta, balance_after, kind, reason,
    ref_type, ref_id, created_by
  ) values (
    p_host_id, p_purpose, p_delta, v_balance, p_kind, p_reason,
    p_ref_type, p_ref_id, p_created_by
  );

  return v_balance;
end;
$$;

revoke all on function public.apply_wielo_credit(
  uuid, text, integer, text, text, text, text, uuid
) from anon, authenticated;
