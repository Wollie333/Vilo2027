-- Harden the Wielo Credits engine (sweep findings #2 + #5).
--
-- #2 (HIGH) — cross-host idempotency collision: apply_wielo_credit's dedupe
--   predicate omitted host_id, so two hosts on the same credit-bearing plan whose
--   subscription grant shares a (ref_type, ref_id, kind) — e.g. the monthly
--   membership grant keyed 'subscription':'<productId>:<YYYY-MM-DD>' — collided.
--   The first host's grant wrote the ledger row; every other same-day host was
--   treated as a duplicate and silently granted 0 credits.
--
-- #5 (MED) — non-atomic idempotency: the dedupe was a bare exists-check with no
--   unique constraint and (for grants) no row lock, so two concurrent calls with
--   the same ref both read 'not exists' and both applied the movement
--   (double-grant on the webhook+return settle race; double-debit on a
--   double-clicked send).
--
-- Fix: (a) a partial UNIQUE index that makes a repeated movement impossible at
-- the storage layer, keyed per HOST; (b) rewrite apply_wielo_credit to lock the
-- wallet row for BOTH grants and debits and re-check idempotency AFTER the lock,
-- so concurrent duplicates serialize and the second is a no-op; the dedupe
-- predicate now includes host_id.

-- (a) Storage-layer backstop. Keyed on host so different hosts sharing a
-- (ref_type, ref_id, kind) never collide, while a true repeat for the SAME host
-- is rejected. Partial: unreferenced movements (ref_id null, e.g. manual
-- adjustments) are exempt.
create unique index if not exists uq_wielo_credit_ledger_ref
  on public.wielo_credit_ledger (host_id, ref_type, ref_id, kind)
  where ref_id is not null;

-- (b) Atomic + host-scoped idempotent movement.
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
  v_dupe boolean;
begin
  -- Fast path: this exact movement for THIS host already recorded (host_id is
  -- now part of the predicate — the #2 fix). Cheap pre-lock check.
  if p_ref_id is not null and p_ref_type is not null then
    if exists (
      select 1 from wielo_credit_ledger
      where host_id = p_host_id
        and ref_type = p_ref_type and ref_id = p_ref_id and kind = p_kind
    ) then
      select coalesce(balance, 0) into v_balance
        from wielo_credit_wallet
        where host_id = p_host_id and purpose = p_purpose;
      return coalesce(v_balance, 0);
    end if;
  end if;

  -- Ensure the wallet exists, then LOCK it for both grants and debits so
  -- concurrent movements for this (host, purpose) serialize (the #5 fix — the
  -- lock was previously debit-only, so grants could double-apply).
  insert into wielo_credit_wallet (host_id, purpose, balance)
    values (p_host_id, p_purpose, 0)
  on conflict (host_id, purpose) do nothing;

  select coalesce(balance, 0) into v_balance
    from wielo_credit_wallet
    where host_id = p_host_id and purpose = p_purpose
    for update;

  -- Re-check idempotency AFTER acquiring the lock: a concurrent duplicate that
  -- committed while we waited is now visible → no-op, return the settled balance.
  if p_ref_id is not null and p_ref_type is not null then
    select exists (
      select 1 from wielo_credit_ledger
      where host_id = p_host_id
        and ref_type = p_ref_type and ref_id = p_ref_id and kind = p_kind
    ) into v_dupe;
    if v_dupe then
      return v_balance;
    end if;
  end if;

  -- Clean error on an over-debit (never a raw CHECK violation).
  if p_delta < 0 and v_balance + p_delta < 0 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

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
